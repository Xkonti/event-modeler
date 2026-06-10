import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import { decide, type BusinessFactCommand } from './businessFact.ts';
import { sanitizeFields } from '../../shared/fields.ts';
import { handleBusinessFact } from './commandHandler.ts';
import { checkLaneAssignable } from '../context/assignmentChecks.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for the business-fact entity. Writes go through the decider +
 * command handler (per-entity stream); a duplicate name (per model, across
 * types) surfaces as 409 when the inline `entity_names` constraint rolls the
 * append back. The read endpoint queries the async catalog read model.
 *
 * `modelId` is supplied by the client on Define (the entity is created inside a
 * model); mutations (rename/fields/archive) need only `entityId` — the decider
 * stamps `modelId` from stream state. WRITE routes guarded; GET open in v1.
 * Mounted under `/api` → `/api/business-facts*`.
 */
export const businessFactApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    const run = async (
      res: Response,
      id: string,
      command: BusinessFactCommand,
    ) => {
      try {
        const result = await handleBusinessFact(eventStore, id, (state) =>
          decide(command, state),
        );
        res
          .header('ETag', String(result.nextExpectedStreamVersion))
          .status(200)
          .json({ ok: true });
      } catch (error) {
        // Duplicate name (entity_names rolled back), a within-stream rule
        // violation, or an optimistic-concurrency conflict all land here → 409.
        // Body stays generic so no PG/internal text reaches the wire.
        console.error('[businessFact] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: name already in use or concurrent modification',
        });
      }
    };

    router.post('/business-facts', guard, (req: Request, res: Response) => {
      const { modelId, entityId, name, fields } = req.body ?? {};
      if (typeof modelId !== 'string' || modelId.length === 0)
        return void res.status(400).json({ ok: false, error: 'modelId required' });
      if (typeof entityId !== 'string' || entityId.length === 0)
        return void res.status(400).json({ ok: false, error: 'entityId required' });
      void run(res, entityId, {
        type: 'DefineBusinessFact',
        data: { modelId, entityId, name, fields: sanitizeFields(fields) },
      });
    });

    router.put('/business-facts/:id/name', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      void run(res, entityId, {
        type: 'RenameBusinessFact',
        data: { entityId, name: req.body.name },
      });
    });

    router.put('/business-facts/:id/fields', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      const { fields } = req.body ?? {};
      void run(res, entityId, {
        type: 'UpdateBusinessFactFields',
        data: { entityId, fields: sanitizeFields(fields) },
      });
    });

    // Lane assignment (X1, Flow 2): last-write-wins re-assign (E1). The target
    // context's existence/model is a cross-stream check → 422 before the decider.
    router.put(
      '/business-facts/:id/context',
      guard,
      async (req: Request, res: Response): Promise<void> => {
        const entityId = req.params.id;
        const { contextId } = req.body ?? {};
        if (!entityId || typeof contextId !== 'string' || contextId.length === 0) {
          res.status(400).json({ ok: false, error: 'missing id or contextId' });
          return;
        }
        const check = await checkLaneAssignable(entityId, contextId);
        if (!check.ok) {
          res.status(check.status).json({ ok: false, error: check.error });
          return;
        }
        await run(res, entityId, {
          type: 'AssignBusinessFactToContext',
          data: { entityId, contextId },
        });
      },
    );

    router.delete('/business-facts/:id/context', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      void run(res, entityId, { type: 'ClearBusinessFactContext', data: { entityId } });
    });

    router.delete('/business-facts/:id', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      void run(res, entityId, { type: 'ArchiveBusinessFact', data: { entityId } });
    });

    router.get('/business-facts/:id', async (req: Request, res: Response): Promise<void> => {
      const doc = await documents
        .collection<CatalogEntry>('entity_catalog')
        .findOne({ _id: req.params.id });
      if (!doc) {
        res.status(404).json({ ok: false, error: 'not found' });
        return;
      }
      // Clean DTO — Pongo docs carry a BigInt `_version` res.json can't serialize.
      const { _id, modelId, entityType, name, definition, archived, contextId } = doc;
      res
        .status(200)
        .json({ _id, modelId, entityType, name, definition, archived, contextId });
    });
  };
