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
import type { ScenarioDoc } from '../../read/scenarios.ts';
import type { ChapterDoc } from '../../read/chapters.ts';
import { decide, type SliceCommand } from './slice.ts';
import { handleSlice } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for the slice entity. Writes go through the decider (per-slice
 * stream); placing an entity first resolves it in the catalog (must exist, be
 * unarchived, and belong to the slice's model — G-C8) so the decider can compute
 * band + slot from its type (F3).
 *
 * The GET is the slice_canvas read (S2): placements joined with the catalog
 * (name/type/definition + LANE = the catalog's contextId, facts only), edges
 * with their STORED kind/meta (F4) when both endpoints are visible, and the
 * scenarios that reference any visible entity (F6 auto-surface). Placements
 * whose catalog row is missing or archived are DROPPED (render-time safety net;
 * the A1 cascade is the real cleanup).
 *
 * WRITE routes are `requireAuth`-guarded; GET is OPEN in v1. Mounted under
 * `/api` → `/api/slices*`.
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
        // Within-stream rejection (e.g. place-on-archived, dup placement, band
        // cardinality) or an optimistic-concurrency conflict. Body stays generic.
        console.error('[slice] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: invalid slice operation or concurrent modification',
        });
      }
    };

    router.post('/slices', guard, (req: Request, res: Response) => {
      const { modelId, sliceId, name } = req.body ?? {};
      if (typeof modelId !== 'string' || modelId.length === 0)
        return void res.status(400).json({ ok: false, error: 'modelId required' });
      if (typeof sliceId !== 'string' || sliceId.length === 0)
        return void res.status(400).json({ ok: false, error: 'sliceId required' });
      void run(res, sliceId, { type: 'DefineSlice', data: { modelId, sliceId, name } });
    });

    router.post(
      '/slices/:id/placements',
      guard,
      async (req: Request, res: Response): Promise<void> => {
        const sliceId = req.params.id;
        const { placedEntityId } = req.body ?? {};
        if (!sliceId || typeof placedEntityId !== 'string' || !placedEntityId) {
          res.status(400).json({ error: 'missing sliceId or placedEntityId' });
          return;
        }
        // Cross-stream pre-check: the placed entity must exist in the catalog,
        // be active, and belong to the slice's model. Its TYPE drives band +
        // cardinality in the decider (F3).
        const [entry, slice] = await Promise.all([
          documents
            .collection<CatalogEntry>('entity_catalog')
            .findOne({ _id: placedEntityId }),
          documents
            .collection<SlicePlacementsDoc>('slice_placements')
            .findOne({ _id: sliceId }),
        ]);
        if (!entry || entry.archived) {
          res.status(422).json({ ok: false, error: 'placed entity not found' });
          return;
        }
        if (entry.entityType === 'readModel') {
          res.status(422).json({
            ok: false,
            error: 'read models are displayed automatically from relations',
          });
          return;
        }
        if (!slice || slice.archived) {
          res.status(422).json({ ok: false, error: 'slice not found' });
          return;
        }
        if (entry.modelId !== slice.modelId) {
          res
            .status(422)
            .json({ ok: false, error: 'entity belongs to a different model' });
          return;
        }
        await run(res, sliceId, {
          type: 'PlaceEntity',
          data: { sliceId, placedEntityId, entityType: entry.entityType },
        });
      },
    );

    // Reorder within a band: swap the two placements' slot numbers (F3).
    router.post('/slices/:id/swaps', guard, (req: Request, res: Response) => {
      const sliceId = req.params.id;
      const { entityIdA, entityIdB } = req.body ?? {};
      if (!sliceId || !entityIdA || !entityIdB)
        return void res.status(400).json({ error: 'missing sliceId or entity ids' });
      void run(res, sliceId, {
        type: 'SwapEntitySlots',
        data: { sliceId, entityIdA, entityIdB },
      });
    });

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
          data: { sliceId, placedEntityId },
        });
      },
    );

    // C1: assign to a chapter (one per slice, LWW). Cross-stream pre-check
    // against the async `chapters` read model (eventually consistent, same
    // convention as placements/relations — clients retry 422).
    router.put(
      '/slices/:id/chapter',
      guard,
      async (req: Request, res: Response): Promise<void> => {
        const sliceId = req.params.id;
        const { chapterId } = req.body ?? {};
        if (!sliceId || typeof chapterId !== 'string' || !chapterId) {
          res.status(400).json({ error: 'missing sliceId or chapterId' });
          return;
        }
        const [chapter, slice] = await Promise.all([
          documents.collection<ChapterDoc>('chapters').findOne({ _id: chapterId }),
          documents
            .collection<SlicePlacementsDoc>('slice_placements')
            .findOne({ _id: sliceId }),
        ]);
        if (!chapter || chapter.archived) {
          res.status(422).json({ ok: false, error: 'chapter not found' });
          return;
        }
        if (!slice || slice.archived) {
          res.status(422).json({ ok: false, error: 'slice not found' });
          return;
        }
        if (chapter.modelId !== slice.modelId) {
          res
            .status(422)
            .json({ ok: false, error: 'chapter belongs to a different model' });
          return;
        }
        await run(res, sliceId, {
          type: 'AssignSliceToChapter',
          data: { sliceId, chapterId },
        });
      },
    );

    router.delete('/slices/:id/chapter', guard, (req: Request, res: Response) => {
      const sliceId = req.params.id;
      if (!sliceId) return void res.status(400).json({ error: 'missing id' });
      void run(res, sliceId, { type: 'ClearSliceChapter', data: { sliceId } });
    });

    router.put('/slices/:id/name', guard, (req: Request, res: Response) => {
      const sliceId = req.params.id;
      if (!sliceId) return void res.status(400).json({ error: 'missing id' });
      void run(res, sliceId, {
        type: 'RenameSlice',
        data: { sliceId, name: req.body.name },
      });
    });

    router.delete('/slices/:id', guard, (req: Request, res: Response) => {
      const sliceId = req.params.id;
      if (!sliceId) return void res.status(400).json({ error: 'missing id' });
      void run(res, sliceId, { type: 'ArchiveSlice', data: { sliceId } });
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

        // Resolve name/type/definition + lane; drop placements whose entity is
        // gone or archived. Lane derives from the catalog's contextId (facts).
        // Sorted by band (top→bottom) then slot so the response order IS the
        // render order — slots may have holes after removals, so consumers
        // must not invent their own ordering from array math.
        const BAND_ORDER: Record<string, number> = {
          trigger: 0,
          command: 1,
          fact: 2,
        };
        const placements = slice.placements
          .flatMap((p: SlicePlacement) => {
            const entry = byId.get(p.placedEntityId);
            if (!entry || entry.archived) return [];
            // Read models are auto-displayed from relations now; historic
            // readModel placements are dropped at read time (no migrations).
            if (entry.entityType === 'readModel') return [];
            return [
              {
                entityId: p.placedEntityId,
                entityType: entry.entityType,
                slotRole: p.slotRole,
                slot: p.slot,
                lane: entry.contextId,
                name: entry.name,
                definition: entry.definition,
              },
            ];
          })
          .sort(
            (a, b) =>
              (BAND_ORDER[a.slotRole] ?? 9) - (BAND_ORDER[b.slotRole] ?? 9) ||
              // Within a band: slotted placements in slot order, unslotted
              // singles (automation/translation in the trigger band) last.
              (a.slot ?? Number.MAX_SAFE_INTEGER) - (b.slot ?? Number.MAX_SAFE_INTEGER),
          );

        // Relations among the visible placed entities → auto-rendered as edges.
        // Kind is STORED on the edge (F4); endpoints must still both be visible.
        const visibleIds = placements.map((p) => p.entityId);
        const edges = visibleIds.length
          ? await documents
              .collection<RelationEdgeDoc>('relations_graph')
              .find({ fromId: { $in: visibleIds }, toId: { $in: visibleIds } })
          : [];
        const relations = edges.flatMap((e) => {
          if (!byId.get(e.fromId) || !byId.get(e.toId)) return [];
          return [{ _id: e._id, fromId: e.fromId, toId: e.toId, kind: e.kind, meta: e.meta }];
        });

        // Read models leave `visibleIds` (no placements), but the canvas still
        // auto-displays them next to their readers — so RM-anchored scenarios
        // must keep surfacing. Union in the RMs read by this slice's triggers.
        const triggerIds = placements
          .filter(
            (p) =>
              p.slotRole === 'trigger' &&
              (p.entityType === 'wireframe' || p.entityType === 'automation'),
          )
          .map((p) => p.entityId);
        const displayEdges = triggerIds.length
          ? await documents
              .collection<RelationEdgeDoc>('relations_graph')
              .find({
                toId: { $in: triggerIds },
                kind: { $in: ['displayedBy', 'monitoredBy'] },
              })
          : [];

        // Scenarios referencing any visible entity auto-surface on the canvas
        // (F6). Filtered in JS over the model's scenarios — model-sized, v1-fine.
        const modelScenarios = await documents
          .collection<ScenarioDoc>('scenarios')
          .find({ modelId: slice.modelId, archived: false });
        const visible = new Set([...visibleIds, ...displayEdges.map((e) => e.fromId)]);
        const scenarios = modelScenarios
          .filter((s) => s.referencedEntityIds.some((id) => visible.has(id)))
          .map(({ _id, kind, anchorId, given, when, then, referencedEntityIds }) => ({
            _id,
            kind,
            anchorId,
            given,
            when,
            then,
            referencedEntityIds,
          }));

        res.status(200).json({
          _id: slice._id,
          modelId: slice.modelId,
          name: slice.name,
          chapterId: slice.chapterId,
          placements,
          relations,
          scenarios,
        });
      },
    );
  };
