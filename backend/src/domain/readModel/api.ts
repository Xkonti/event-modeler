import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import { decide, type ReadModelCommand } from './readModel.ts';
import { handleReadModel } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for the read-model entity — same shape as business-facts. Writes
 * go through the decider; a duplicate name (per model, across types) surfaces as
 * 409 when the inline `entity_names` constraint rolls the append back. GET reads
 * the async catalog. Mounted under `/api` → `/api/read-models*`. Writes guarded;
 * GET open in v1.
 */
export const readModelApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    const run = async (res: Response, id: string, command: ReadModelCommand) => {
      try {
        const result = await handleReadModel(eventStore, id, (state) =>
          decide(command, state),
        );
        res
          .header('ETag', String(result.nextExpectedStreamVersion))
          .status(200)
          .json({ ok: true });
      } catch (error) {
        console.error('[readModel] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: name already in use or concurrent modification',
        });
      }
    };

    router.post('/read-models', guard, (req: Request, res: Response) => {
      const { modelId, entityId, name, fields } = req.body ?? {};
      if (typeof modelId !== 'string' || modelId.length === 0)
        return void res.status(400).json({ ok: false, error: 'modelId required' });
      if (typeof entityId !== 'string' || entityId.length === 0)
        return void res.status(400).json({ ok: false, error: 'entityId required' });
      void run(res, entityId, {
        type: 'DefineReadModel',
        data: { modelId, entityId, name, fields: Array.isArray(fields) ? fields : [] },
      });
    });

    router.put('/read-models/:id/name', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      void run(res, entityId, {
        type: 'RenameReadModel',
        data: { entityId, name: req.body.name },
      });
    });

    router.put('/read-models/:id/fields', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      const { fields } = req.body ?? {};
      void run(res, entityId, {
        type: 'UpdateReadModelFields',
        data: { entityId, fields: Array.isArray(fields) ? fields : [] },
      });
    });

    router.delete('/read-models/:id', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      void run(res, entityId, { type: 'ArchiveReadModel', data: { entityId } });
    });

    router.get('/read-models/:id', async (req: Request, res: Response): Promise<void> => {
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
