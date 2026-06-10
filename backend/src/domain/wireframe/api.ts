import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import { decide, type WireframeCommand } from './wireframe.ts';
import { handleWireframe } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for the wireframe entity — the catalog template shape, with a
 * `content` payload instead of `fields` (edited via PUT /:id/content). Duplicate
 * name (per model, across types) → 409 via the inline `entity_names` rollback.
 * Mounted under `/api` → `/api/wireframes*`. Writes guarded; GET open in v1.
 */
export const wireframeApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    const run = async (res: Response, id: string, command: WireframeCommand) => {
      try {
        const result = await handleWireframe(eventStore, id, (state) =>
          decide(command, state),
        );
        res
          .header('ETag', String(result.nextExpectedStreamVersion))
          .status(200)
          .json({ ok: true });
      } catch (error) {
        console.error('[wireframe] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: name already in use or concurrent modification',
        });
      }
    };

    router.post('/wireframes', guard, (req: Request, res: Response) => {
      const { modelId, entityId, name, content } = req.body ?? {};
      if (typeof modelId !== 'string' || modelId.length === 0)
        return void res.status(400).json({ ok: false, error: 'modelId required' });
      if (typeof entityId !== 'string' || entityId.length === 0)
        return void res.status(400).json({ ok: false, error: 'entityId required' });
      void run(res, entityId, {
        type: 'DefineWireframe',
        data: { modelId, entityId, name, content: typeof content === 'string' ? content : '' },
      });
    });

    router.put('/wireframes/:id/name', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      void run(res, entityId, {
        type: 'RenameWireframe',
        data: { entityId, name: req.body.name },
      });
    });

    router.put('/wireframes/:id/content', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      const { content } = req.body ?? {};
      void run(res, entityId, {
        type: 'UpdateWireframeContent',
        data: { entityId, content: typeof content === 'string' ? content : '' },
      });
    });

    router.delete('/wireframes/:id', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      void run(res, entityId, { type: 'ArchiveWireframe', data: { entityId } });
    });

    router.get('/wireframes/:id', async (req: Request, res: Response): Promise<void> => {
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
