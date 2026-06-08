import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import type {
  SlicePlacement,
  SlicePlacementsDoc,
} from '../../read/slicePlacements.ts';
import type { RelationEdgeDoc } from '../../read/relationsGraph.ts';
import { deriveKind } from '../../shared/relationKind.ts';
import { decide, type SliceCommand } from './slice.ts';
import { handleSlice } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for the slice entity. Writes go through the decider (per-slice
 * stream); the GET is a read-side Pongo join of `slice_placements` with
 * `entity_catalog` — it resolves each placed entity's name/type and DROPS any
 * placement whose catalog row is missing or archived (no ghosts on the canvas).
 *
 * WRITE routes are `requireAuth`-guarded (401 before any decider runs); GET is
 * OPEN in v1. `buildAuthApp` mounts this under `/api` → `/api/slices*`.
 */
export const sliceApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    const run = async (res: Response, id: string, command: SliceCommand) => {
      try {
        const result = await handleSlice(eventStore, id, (state) =>
          decide(command, state),
        );
        res
          .header('ETag', String(result.nextExpectedStreamVersion))
          .status(200)
          .json({ ok: true });
      } catch (error) {
        // Within-stream rejection (e.g. place-on-archived, dup placement) or an
        // optimistic-concurrency conflict. Body stays generic; raw error logged.
        console.error('[slice] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: invalid slice operation or concurrent modification',
        });
      }
    };

    router.post('/slices', guard, (req: Request, res: Response) => {
      const { entityId, name } = req.body;
      void run(res, entityId, { type: 'DefineSlice', data: { entityId, name } });
    });

    router.post(
      '/slices/:id/placements',
      guard,
      (req: Request, res: Response) => {
        const sliceId = req.params.id;
        if (!sliceId) return void res.status(400).json({ error: 'missing id' });
        const { placedEntityId, x, y } = req.body;
        void run(res, sliceId, {
          type: 'PlaceEntity',
          data: { entityId: sliceId, placedEntityId, x, y },
        });
      },
    );

    router.put(
      '/slices/:id/placements/:placedId',
      guard,
      (req: Request, res: Response) => {
        const sliceId = req.params.id;
        const placedEntityId = req.params.placedId;
        if (!sliceId || !placedEntityId)
          return void res.status(400).json({ error: 'missing id' });
        const { x, y } = req.body;
        void run(res, sliceId, {
          type: 'MoveEntity',
          data: { entityId: sliceId, placedEntityId, x, y },
        });
      },
    );

    router.delete(
      '/slices/:id/placements/:placedId',
      guard,
      (req: Request, res: Response) => {
        const sliceId = req.params.id;
        const placedEntityId = req.params.placedId;
        if (!sliceId || !placedEntityId)
          return void res.status(400).json({ error: 'missing id' });
        void run(res, sliceId, {
          type: 'RemoveEntityFromSlice',
          data: { entityId: sliceId, placedEntityId },
        });
      },
    );

    router.put('/slices/:id/name', guard, (req: Request, res: Response) => {
      const sliceId = req.params.id;
      if (!sliceId) return void res.status(400).json({ error: 'missing id' });
      void run(res, sliceId, {
        type: 'RenameSlice',
        data: { entityId: sliceId, name: req.body.name },
      });
    });

    router.delete('/slices/:id', guard, (req: Request, res: Response) => {
      const sliceId = req.params.id;
      if (!sliceId) return void res.status(400).json({ error: 'missing id' });
      void run(res, sliceId, {
        type: 'ArchiveSlice',
        data: { entityId: sliceId },
      });
    });

    router.get(
      '/slices/:id',
      async (req: Request, res: Response): Promise<void> => {
        const slice = await documents
          .collection<SlicePlacementsDoc>('slice_placements')
          .findOne({ _id: req.params.id });
        if (!slice) {
          res.status(404).json({ ok: false, error: 'not found' });
          return;
        }

        const placedIds = slice.placements.map((p) => p.placedEntityId);
        const catalog = placedIds.length
          ? await documents
              .collection<CatalogEntry>('entity_catalog')
              .find({ _id: { $in: placedIds } })
          : [];
        const byId = new Map(catalog.map((c) => [c._id, c]));

        // Resolve name/type; drop placements whose entity is gone or archived.
        const placements = slice.placements.flatMap((p: SlicePlacement) => {
          const entry = byId.get(p.placedEntityId);
          if (!entry || entry.archived) return [];
          return [
            {
              entityId: p.placedEntityId,
              x: p.x,
              y: p.y,
              name: entry.name,
              entityType: entry.entityType,
            },
          ];
        });

        // Relations among the visible placed entities → auto-rendered as edges.
        // Kind is derived at read time from the (immutable) endpoint types.
        const visibleIds = placements.map((p) => p.entityId);
        const edges = visibleIds.length
          ? await documents
              .collection<RelationEdgeDoc>('relations_graph')
              .find({ fromId: { $in: visibleIds }, toId: { $in: visibleIds } })
          : [];
        const relations = edges.flatMap((e) => {
          const from = byId.get(e.fromId);
          const to = byId.get(e.toId);
          if (!from || !to) return [];
          const kind = deriveKind(from.entityType, to.entityType);
          if (!kind) return [];
          return [{ _id: e._id, fromId: e.fromId, toId: e.toId, kind }];
        });

        res.status(200).json({
          _id: slice._id,
          name: slice.name,
          placements,
          relations,
        });
      },
    );
  };
