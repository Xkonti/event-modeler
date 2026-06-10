import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import { documents } from '../db.ts';
import type { CatalogEntry } from '../read/entityCatalog.ts';
import type { RelationEdgeDoc } from '../read/relationsGraph.ts';
import type { ScenarioDoc } from '../read/scenarios.ts';
import type { SlicePlacementsDoc } from '../read/slicePlacements.ts';
import { computeModelValidation } from '../read/modelValidation.ts';

/**
 * A2 — the on-demand analysis surface: completeness validation + where-used.
 * Pure READS over the async read models; advisory only, never on a write path
 * (G-C10), recomputed per request (v1: on-demand, not continuous). GETs are
 * open like every other read in v1.
 */
export const analysisApi = (): WebApiSetup => (router: Router) => {
  router.get(
    '/models/:id/validation',
    async (req: Request, res: Response): Promise<void> => {
      const modelId = req.params.id;
      const [entries, edges, scenarios] = await Promise.all([
        documents.collection<CatalogEntry>('entity_catalog').find({ modelId }),
        documents.collection<RelationEdgeDoc>('relations_graph').find({ modelId }),
        documents.collection<ScenarioDoc>('scenarios').find({ modelId }),
      ]);
      const findings = computeModelValidation({ entries, edges, scenarios });
      res.status(200).json({ modelId, findings });
    },
  );

  router.get(
    '/entities/:id/where-used',
    async (req: Request, res: Response): Promise<void> => {
      const entityId = req.params.id;
      if (!entityId) {
        res.status(400).json({ ok: false, error: 'missing id' });
        return;
      }
      const entry = await documents
        .collection<CatalogEntry>('entity_catalog')
        .findOne({ _id: entityId });
      if (!entry) {
        res.status(404).json({ ok: false, error: 'not found' });
        return;
      }
      const modelId = entry.modelId;
      const [slices, edges, scenarios] = await Promise.all([
        documents.collection<SlicePlacementsDoc>('slice_placements').find({ modelId }),
        documents.collection<RelationEdgeDoc>('relations_graph').find({ modelId }),
        documents.collection<ScenarioDoc>('scenarios').find({ modelId }),
      ]);
      res.status(200).json({
        entityId,
        slices: slices
          .filter(
            (s) =>
              !s.archived &&
              s.placements.some((p) => p.placedEntityId === entityId),
          )
          .map((s) => ({ _id: s._id, name: s.name })),
        relations: edges
          .filter((e) => e.fromId === entityId || e.toId === entityId)
          .map(({ _id, fromId, toId, kind }) => ({ _id, fromId, toId, kind })),
        scenarios: scenarios
          .filter((s) => !s.archived && s.referencedEntityIds.includes(entityId))
          .map(({ _id, kind, anchorId }) => ({ _id, kind, anchorId })),
      });
    },
  );
};
