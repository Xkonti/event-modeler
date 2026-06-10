import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { ContextDoc } from '../../read/contexts.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import { decide, type ContextCommand } from './context.ts';
import { handleContext } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for contexts (swimlanes). Writes go through the decider; a
 * duplicate lane name (per model, contexts' own namespace) surfaces as 409 when
 * the inline `context_names` constraint rolls the append back. Reads query the
 * async `contexts` read model; `factCount` is derived per request by counting
 * catalog entries assigned to the lane (see src/read/contexts.ts).
 *
 * Mounted under `/api` → `/api/contexts*`. Writes guarded; GET open in v1.
 */
export const contextApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    const run = async (res: Response, id: string, command: ContextCommand) => {
      try {
        const result = await handleContext(eventStore, id, (state) =>
          decide(command, state),
        );
        res
          .header('ETag', String(result.nextExpectedStreamVersion))
          .status(200)
          .json({ ok: true });
      } catch (error) {
        console.error('[context] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: name already in use or concurrent modification',
        });
      }
    };

    router.post('/contexts', guard, (req: Request, res: Response) => {
      const { modelId, contextId, name } = req.body ?? {};
      if (typeof modelId !== 'string' || modelId.length === 0)
        return void res.status(400).json({ ok: false, error: 'modelId required' });
      if (typeof contextId !== 'string' || contextId.length === 0)
        return void res.status(400).json({ ok: false, error: 'contextId required' });
      void run(res, contextId, {
        type: 'DefineContext',
        data: { modelId, contextId, name },
      });
    });

    router.put('/contexts/:id/name', guard, (req: Request, res: Response) => {
      const contextId = req.params.id;
      if (!contextId) return void res.status(400).json({ error: 'missing id' });
      void run(res, contextId, {
        type: 'RenameContext',
        data: { contextId, name: req.body.name },
      });
    });

    router.delete('/contexts/:id', guard, (req: Request, res: Response) => {
      const contextId = req.params.id;
      if (!contextId) return void res.status(400).json({ error: 'missing id' });
      void run(res, contextId, { type: 'ArchiveContext', data: { contextId } });
    });

    router.get('/contexts/:id', async (req: Request, res: Response): Promise<void> => {
      const doc = await documents
        .collection<ContextDoc>('contexts')
        .findOne({ _id: req.params.id });
      if (!doc) {
        res.status(404).json({ ok: false, error: 'not found' });
        return;
      }
      const assigned = await documents
        .collection<CatalogEntry>('entity_catalog')
        .find({ contextId: doc._id, archived: false });
      const { _id, modelId, name, archived } = doc;
      res.status(200).json({ _id, modelId, name, archived, factCount: assigned.length });
    });

    router.get('/contexts', async (req: Request, res: Response): Promise<void> => {
      const modelId = req.query.modelId;
      if (typeof modelId !== 'string' || modelId.length === 0) {
        res.status(400).json({ ok: false, error: 'modelId query param required' });
        return;
      }
      const docs = await documents
        .collection<ContextDoc>('contexts')
        .find({ modelId, archived: false });
      const assigned = await documents
        .collection<CatalogEntry>('entity_catalog')
        .find({ modelId, archived: false });
      const counts = new Map<string, number>();
      for (const entry of assigned)
        if (entry.contextId)
          counts.set(entry.contextId, (counts.get(entry.contextId) ?? 0) + 1);
      res.status(200).json(
        docs.map(({ _id, modelId: m, name, archived }) => ({
          _id,
          modelId: m,
          name,
          archived,
          factCount: counts.get(_id) ?? 0,
        })),
      );
    });
  };
