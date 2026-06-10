import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import { documents } from '../db.ts';
import type { CatalogEntry } from '../read/entityCatalog.ts';
import type { ContextDoc } from '../read/contexts.ts';
import type { ModelDoc } from '../read/models.ts';
import type { RelationEdgeDoc } from '../read/relationsGraph.ts';
import type { ScenarioDoc } from '../read/scenarios.ts';
import type { SlicePlacementsDoc } from '../read/slicePlacements.ts';
import { assembleExport } from '../read/modelExport.ts';

/**
 * O1 — `GET /models/:id/export`, the whole-model state-view query (no recorded
 * fact; ExportModel deliberately isn't a command). Pure READ over the async
 * read models, assembled by `read/modelExport.ts`; open like every other v1
 * read. The W2 [Export] button downloads this verbatim.
 */
export const exportApi = (): WebApiSetup => (router: Router) => {
  router.get(
    '/models/:id/export',
    async (req: Request, res: Response): Promise<void> => {
      const modelId = req.params.id;
      const model = await documents
        .collection<ModelDoc>('models')
        .findOne({ _id: modelId });
      if (!model || model.archived) {
        res.status(404).json({ ok: false, error: 'not found' });
        return;
      }
      const [entries, contexts, slices, relations, scenarios] =
        await Promise.all([
          documents.collection<CatalogEntry>('entity_catalog').find({ modelId }),
          documents.collection<ContextDoc>('contexts').find({ modelId }),
          documents
            .collection<SlicePlacementsDoc>('slice_placements')
            .find({ modelId }),
          documents
            .collection<RelationEdgeDoc>('relations_graph')
            .find({ modelId }),
          documents.collection<ScenarioDoc>('scenarios').find({ modelId }),
        ]);
      res.status(200).json(
        assembleExport({
          model,
          entries,
          contexts,
          slices,
          relations,
          scenarios,
          exportedAt: new Date().toISOString(),
        }),
      );
    },
  );
};
