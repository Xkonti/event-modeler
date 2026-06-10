import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import type { ScenarioDoc } from '../../read/scenarios.ts';
import { decide, type ScenarioCommand } from './scenario.ts';
import type { GivenStep, ScenarioBody, ThenClause, WhenClause } from './events.ts';
import { handleScenario } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for scenarios (GWT/GT rules). References are SOFT — no catalog
 * pre-check on write (a rule may be drafted before/after its targets; G-C10).
 * Reads serve the `scenarios` read model; the single GET derives `outOfSync` by
 * checking every referenced id against the catalog (missing or archived ⇒ out
 * of sync). The list GET filters by model and optionally by referenced entity
 * (F6 — "which rules touch X?").
 *
 * Mounted under `/api` → `/api/scenarios*`. Writes guarded; GET open in v1.
 */

const parseBody = (raw: Record<string, unknown>): ScenarioBody | null => {
  const { anchorId, given, when, then } = raw;
  if (typeof anchorId !== 'string') return null;
  if (given !== undefined && !Array.isArray(given)) return null;
  if (then === undefined || then === null || typeof then !== 'object') return null;
  return {
    anchorId,
    given: (given ?? []) as GivenStep[],
    ...(when !== undefined ? { when: when as WhenClause } : {}),
    then: then as ThenClause,
  };
};

/** Out-of-sync derivation: every referenced entity must exist and be active. */
const deriveOutOfSync = async (doc: ScenarioDoc): Promise<boolean> => {
  if (doc.referencedEntityIds.length === 0) return false;
  const entries = await documents
    .collection<CatalogEntry>('entity_catalog')
    .find({ _id: { $in: doc.referencedEntityIds } });
  const alive = new Set(entries.filter((e) => !e.archived).map((e) => e._id));
  return doc.referencedEntityIds.some((id) => !alive.has(id));
};

const toDto = (doc: ScenarioDoc, outOfSync: boolean) => {
  const { _id, modelId, kind, anchorId, given, when, then, referencedEntityIds, archived } =
    doc;
  return {
    _id,
    modelId,
    kind,
    anchorId,
    given,
    when,
    then,
    referencedEntityIds,
    archived,
    outOfSync,
  };
};

export const scenarioApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    const run = async (res: Response, id: string, command: ScenarioCommand) => {
      try {
        const result = await handleScenario(eventStore, id, (state) =>
          decide(command, state),
        );
        res
          .header('ETag', String(result.nextExpectedStreamVersion))
          .status(200)
          .json({ ok: true });
      } catch (error) {
        console.error('[scenario] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: invalid scenario state or concurrent modification',
        });
      }
    };

    router.post('/scenarios', guard, (req: Request, res: Response) => {
      const { modelId, scenarioId, kind } = req.body ?? {};
      if (typeof modelId !== 'string' || modelId.length === 0)
        return void res.status(400).json({ ok: false, error: 'modelId required' });
      if (typeof scenarioId !== 'string' || scenarioId.length === 0)
        return void res.status(400).json({ ok: false, error: 'scenarioId required' });
      if (kind !== 'GWT' && kind !== 'GT')
        return void res.status(400).json({ ok: false, error: 'kind must be GWT or GT' });
      const body = parseBody(req.body ?? {});
      if (!body)
        return void res
          .status(400)
          .json({ ok: false, error: 'anchorId/given/then malformed' });
      void run(res, scenarioId, {
        type: 'DefineScenario',
        data: { modelId, scenarioId, kind, ...body },
      });
    });

    router.put('/scenarios/:id', guard, (req: Request, res: Response) => {
      const scenarioId = req.params.id;
      if (!scenarioId) return void res.status(400).json({ error: 'missing id' });
      const body = parseBody(req.body ?? {});
      if (!body)
        return void res
          .status(400)
          .json({ ok: false, error: 'anchorId/given/then malformed' });
      void run(res, scenarioId, {
        type: 'UpdateScenario',
        data: { scenarioId, ...body },
      });
    });

    router.delete('/scenarios/:id', guard, (req: Request, res: Response) => {
      const scenarioId = req.params.id;
      if (!scenarioId) return void res.status(400).json({ error: 'missing id' });
      void run(res, scenarioId, { type: 'ArchiveScenario', data: { scenarioId } });
    });

    router.get('/scenarios/:id', async (req: Request, res: Response): Promise<void> => {
      const doc = await documents
        .collection<ScenarioDoc>('scenarios')
        .findOne({ _id: req.params.id });
      if (!doc) {
        res.status(404).json({ ok: false, error: 'not found' });
        return;
      }
      res.status(200).json(toDto(doc, await deriveOutOfSync(doc)));
    });

    // List by model; `?entityId=` narrows to rules referencing that entity (F6).
    router.get('/scenarios', async (req: Request, res: Response): Promise<void> => {
      const modelId = req.query.modelId;
      if (typeof modelId !== 'string' || modelId.length === 0) {
        res.status(400).json({ ok: false, error: 'modelId query param required' });
        return;
      }
      const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : null;
      const docs = await documents
        .collection<ScenarioDoc>('scenarios')
        .find({ modelId, archived: false });
      const filtered = entityId
        ? docs.filter((d) => d.referencedEntityIds.includes(entityId))
        : docs;
      const result = await Promise.all(
        filtered.map(async (d) => toDto(d, await deriveOutOfSync(d))),
      );
      res.status(200).json(result);
    });
  };
