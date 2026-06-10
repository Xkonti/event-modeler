import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import { decide, type AutomationCommand } from './automation.ts';
import type { TriggerConfig } from './events.ts';
import { handleAutomation } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for automations. Same template as the other catalog types, plus a
 * cross-stream pre-check on the triggerConfig refs: the monitored read model /
 * issued command (when given) must exist in the catalog, be unarchived, carry
 * the right entityType, and belong to the same model (G-C8) → else 422. Checked
 * against the async catalog (eventually consistent, acceptable single-user).
 *
 * Mounted under `/api` → `/api/automations*`. Writes guarded; GET open in v1.
 */

type RefCheck = { ok: true } | { ok: false; error: string };

const checkTriggerRefs = async (
  modelId: string,
  config: TriggerConfig,
): Promise<RefCheck> => {
  const refs: Array<{ id: string; expectedType: string; label: string }> = [];
  if (config.monitoredReadModelId)
    refs.push({
      id: config.monitoredReadModelId,
      expectedType: 'readModel',
      label: 'monitored read model',
    });
  if (config.issuedCommandId)
    refs.push({
      id: config.issuedCommandId,
      expectedType: 'command',
      label: 'issued command',
    });
  for (const ref of refs) {
    const entry = await documents
      .collection<CatalogEntry>('entity_catalog')
      .findOne({ _id: ref.id });
    if (!entry || entry.archived) return { ok: false, error: `${ref.label} not found` };
    if (entry.entityType !== ref.expectedType)
      return { ok: false, error: `${ref.label} has wrong type` };
    if (entry.modelId !== modelId)
      return { ok: false, error: `${ref.label} belongs to a different model` };
  }
  return { ok: true };
};

const parseTriggerConfig = (raw: unknown): TriggerConfig | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const { triggerType, monitoredReadModelId, issuedCommandId } = raw as Record<
    string,
    unknown
  >;
  if (typeof triggerType !== 'string') return null;
  return {
    triggerType: triggerType as TriggerConfig['triggerType'],
    ...(typeof monitoredReadModelId === 'string' ? { monitoredReadModelId } : {}),
    ...(typeof issuedCommandId === 'string' ? { issuedCommandId } : {}),
  };
};

export const automationApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    const run = async (res: Response, id: string, command: AutomationCommand) => {
      try {
        const result = await handleAutomation(eventStore, id, (state) =>
          decide(command, state),
        );
        res
          .header('ETag', String(result.nextExpectedStreamVersion))
          .status(200)
          .json({ ok: true });
      } catch (error) {
        console.error('[automation] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: name already in use or concurrent modification',
        });
      }
    };

    router.post(
      '/automations',
      guard,
      async (req: Request, res: Response): Promise<void> => {
        const { modelId, entityId, name } = req.body ?? {};
        if (typeof modelId !== 'string' || modelId.length === 0)
          return void res.status(400).json({ ok: false, error: 'modelId required' });
        if (typeof entityId !== 'string' || entityId.length === 0)
          return void res.status(400).json({ ok: false, error: 'entityId required' });
        const triggerConfig = parseTriggerConfig(req.body?.triggerConfig);
        if (!triggerConfig)
          return void res
            .status(400)
            .json({ ok: false, error: 'triggerConfig required' });
        const check = await checkTriggerRefs(modelId, triggerConfig);
        if (!check.ok) return void res.status(422).json({ ok: false, error: check.error });
        await run(res, entityId, {
          type: 'DefineAutomation',
          data: { modelId, entityId, name, triggerConfig },
        });
      },
    );

    router.put('/automations/:id/name', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      void run(res, entityId, {
        type: 'RenameAutomation',
        data: { entityId, name: req.body.name },
      });
    });

    router.put(
      '/automations/:id/trigger-config',
      guard,
      async (req: Request, res: Response): Promise<void> => {
        const entityId = req.params.id;
        if (!entityId) return void res.status(400).json({ error: 'missing id' });
        const triggerConfig = parseTriggerConfig(req.body?.triggerConfig);
        if (!triggerConfig)
          return void res
            .status(400)
            .json({ ok: false, error: 'triggerConfig required' });
        // The automation's own modelId comes from the catalog (the decider would
        // also stamp it, but the ref pre-check needs it BEFORE deciding).
        const self = await documents
          .collection<CatalogEntry>('entity_catalog')
          .findOne({ _id: entityId });
        if (!self || self.archived || !self.modelId)
          return void res.status(422).json({ ok: false, error: 'automation not found' });
        const check = await checkTriggerRefs(self.modelId, triggerConfig);
        if (!check.ok) return void res.status(422).json({ ok: false, error: check.error });
        await run(res, entityId, {
          type: 'ReconfigureAutomation',
          data: { entityId, triggerConfig },
        });
      },
    );

    router.delete('/automations/:id', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      void run(res, entityId, { type: 'ArchiveAutomation', data: { entityId } });
    });

    router.get('/automations/:id', async (req: Request, res: Response): Promise<void> => {
      const doc = await documents
        .collection<CatalogEntry>('entity_catalog')
        .findOne({ _id: req.params.id });
      if (!doc) {
        res.status(404).json({ ok: false, error: 'not found' });
        return;
      }
      const { _id, modelId, entityType, name, definition, archived } = doc;
      res.status(200).json({ _id, modelId, entityType, name, definition, archived });
    });
  };
