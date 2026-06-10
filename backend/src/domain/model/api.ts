import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { ModelDoc } from '../../read/models.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import { decide, type ModelCommand } from './model.ts';
import { handleModel } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for the model (root container). Writes go through the decider +
 * command handler (per-model stream); the read endpoints query the async
 * `models` read model.
 *
 * The root `modelId` is GENERATED server-side (the client cannot pick the root
 * id) and returned on create — unlike the catalog entities, whose `entityId` the
 * client supplies. WRITE routes are guarded by `requireAuth`; GET stays open in
 * v1 (notes/auth-architecture.md). Mounted under `/api` → `/api/models*`.
 */
export const modelApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    const run = async (res: Response, modelId: string, command: ModelCommand) => {
      try {
        const result = await handleModel(eventStore, modelId, (state) =>
          decide(command, state),
        );
        res
          .header('ETag', String(result.nextExpectedStreamVersion))
          .status(200)
          .json({ ok: true, modelId });
      } catch (error) {
        // A within-stream rule violation (create-twice, edit-archived,
        // re-archive) or an optimistic-concurrency conflict lands here. Both map
        // to 409; the body stays generic so no PG/internal text reaches the wire.
        console.error('[model] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: invalid model state or concurrent modification',
        });
      }
    };

    router.post('/models', guard, (req: Request, res: Response) => {
      const name = req.body?.name;
      if (typeof name !== 'string' || name.trim().length === 0)
        return void res.status(400).json({ ok: false, error: 'name required' });
      const modelId = randomUUID();
      void run(res, modelId, { type: 'CreateModel', data: { modelId, name } });
    });

    router.put('/models/:id/name', guard, (req: Request, res: Response) => {
      const modelId = req.params.id;
      if (!modelId) return void res.status(400).json({ error: 'missing id' });
      const name = req.body?.name;
      if (typeof name !== 'string' || name.trim().length === 0)
        return void res.status(400).json({ ok: false, error: 'name required' });
      void run(res, modelId, { type: 'RenameModel', data: { modelId, name } });
    });

    router.delete('/models/:id', guard, (req: Request, res: Response) => {
      const modelId = req.params.id;
      if (!modelId) return void res.status(400).json({ error: 'missing id' });
      void run(res, modelId, { type: 'ArchiveModel', data: { modelId } });
    });

    router.get('/models', async (_req: Request, res: Response): Promise<void> => {
      const docs = await documents
        .collection<ModelDoc>('models')
        .find({ archived: false });
      // Clean DTOs — Pongo docs carry a BigInt `_version` that res.json can't serialize.
      res.status(200).json(
        docs.map(({ _id, name, archived, sliceCount }) => ({
          _id,
          name,
          archived,
          sliceCount,
        })),
      );
    });

    router.get('/models/:id', async (req: Request, res: Response): Promise<void> => {
      const doc = await documents
        .collection<ModelDoc>('models')
        .findOne({ _id: req.params.id });
      if (!doc) {
        res.status(404).json({ ok: false, error: 'not found' });
        return;
      }
      const { _id, name, archived, sliceCount } = doc;
      res.status(200).json({ _id, name, archived, sliceCount });
    });

    // Creation order for the catalog lists: definedAtPosition (global log
    // position of the *Defined event), missing-last (pre-field docs), `_id`
    // tiebreak. Pongo `find` has no sort option — the model-sized result is
    // sorted in JS.
    const byDefinedAt = (a: CatalogEntry, b: CatalogEntry): number =>
      (a.definedAtPosition ?? Number.MAX_SAFE_INTEGER) -
        (b.definedAtPosition ?? Number.MAX_SAFE_INTEGER) ||
      a._id.localeCompare(b._id);

    // The model's entity catalog — feeds the W3 palette, every entity picker,
    // and the client-side dup-name lookup. Slices are cataloged too but are NOT
    // entities (they list via /models/:id/slices below).
    router.get(
      '/models/:id/entities',
      async (req: Request, res: Response): Promise<void> => {
        const entries = await documents
          .collection<CatalogEntry>('entity_catalog')
          .find({ modelId: req.params.id, archived: false });
        const dto = entries
          .filter((e) => e.entityType !== 'slice')
          .sort(byDefinedAt)
          .map(({ _id, entityType, name, contextId, definedAtPosition }) => ({
            _id,
            entityType,
            name,
            contextId,
            definedAtPosition,
          }));
        res.status(200).json(dto);
      },
    );

    // The model's slices in creation order — the W3 canvas tiles boxes
    // left→right in exactly this order (decided 2026-06-09: creation order).
    router.get(
      '/models/:id/slices',
      async (req: Request, res: Response): Promise<void> => {
        const entries = await documents
          .collection<CatalogEntry>('entity_catalog')
          .find({
            modelId: req.params.id,
            entityType: 'slice',
            archived: false,
          });
        const dto = entries
          .sort(byDefinedAt)
          .map(({ _id, name }) => ({ _id, name }));
        res.status(200).json(dto);
      },
    );
  };
