import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import type { RelationEdgeDoc } from '../../read/relationsGraph.ts';
import { kindForPair } from '../../shared/relationKind.ts';
import { decide } from './relation.ts';
import type { RelationMeta } from './events.ts';
import { handleRelation } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for relations. Drawing first builds a transient decision model
 * from the catalog: both endpoints must exist, be unarchived, belong to the
 * SAME model as the command (G-C8), form an allowed directed type-pair, and the
 * submitted `kind` must be the one the 11-pair allow-list assigns (F4) → else
 * 422. Only then does the pure decider run; the duplicate-(from,to,kind) rule
 * (E3) is the inline `relation_pairs` constraint → 409 on rollback.
 *
 * Kind changes (PUT) re-validate the new kind against the endpoint types
 * (resolved via the relations_graph + catalog read models — eventually
 * consistent, acceptable single-user). Mounted under `/api` → `/api/relations*`.
 */
export const relationApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    router.post(
      '/relations',
      guard,
      async (req: Request, res: Response): Promise<void> => {
        const { modelId, relationId, fromId, toId, kind, meta } = req.body ?? {};
        if (!modelId || !relationId || !fromId || !toId || typeof kind !== 'string') {
          res
            .status(400)
            .json({ error: 'missing modelId/relationId/fromId/toId/kind' });
          return;
        }

        const catalog = documents.collection<CatalogEntry>('entity_catalog');
        const [from, to] = await Promise.all([
          catalog.findOne({ _id: fromId }),
          catalog.findOne({ _id: toId }),
        ]);
        if (!from || from.archived || !to || to.archived) {
          res.status(422).json({ ok: false, error: 'relation endpoint not found' });
          return;
        }
        if (from.modelId !== modelId || to.modelId !== modelId) {
          res
            .status(422)
            .json({ ok: false, error: 'relation endpoint belongs to a different model' });
          return;
        }
        const allowedKind = kindForPair(from.entityType, to.entityType);
        if (!allowedKind) {
          res.status(422).json({ ok: false, error: 'invalid relation type pair' });
          return;
        }
        if (kind !== allowedKind) {
          res.status(422).json({
            ok: false,
            error: `invalid kind for this pair (expected '${allowedKind}')`,
          });
          return;
        }

        try {
          const result = await handleRelation(eventStore, relationId, (state) =>
            decide(
              {
                type: 'DrawRelation',
                data: {
                  modelId,
                  relationId,
                  fromId,
                  toId,
                  kind,
                  meta: meta as RelationMeta | undefined,
                },
              },
              state,
            ),
          );
          res
            .header('ETag', String(result.nextExpectedStreamVersion))
            .status(200)
            .json({ ok: true });
        } catch (error) {
          // Already drawn, a duplicate (from,to,kind) rolled back by the inline
          // relation_pairs constraint (E3), or a concurrency conflict.
          console.error('[relation] draw conflict:', error);
          res.status(409).json({
            ok: false,
            error: 'conflict: relation already exists or concurrent modification',
          });
        }
      },
    );

    router.put(
      '/relations/:id',
      guard,
      async (req: Request, res: Response): Promise<void> => {
        const relationId = req.params.id;
        if (!relationId) {
          res.status(400).json({ error: 'missing id' });
          return;
        }
        const { kind, meta } = req.body ?? {};
        if (kind !== undefined && typeof kind !== 'string') {
          res.status(400).json({ error: 'kind must be a string' });
          return;
        }

        // A kind change must still match the endpoints' allowed kind (F4).
        if (typeof kind === 'string') {
          const edge = await documents
            .collection<RelationEdgeDoc>('relations_graph')
            .findOne({ _id: relationId });
          if (!edge) {
            res.status(422).json({ ok: false, error: 'relation not found' });
            return;
          }
          const catalog = documents.collection<CatalogEntry>('entity_catalog');
          const [from, to] = await Promise.all([
            catalog.findOne({ _id: edge.fromId }),
            catalog.findOne({ _id: edge.toId }),
          ]);
          const allowedKind =
            from && to ? kindForPair(from.entityType, to.entityType) : null;
          if (!allowedKind || kind !== allowedKind) {
            res.status(422).json({
              ok: false,
              error: allowedKind
                ? `invalid kind for this pair (expected '${allowedKind}')`
                : 'relation endpoint not found',
            });
            return;
          }
        }

        try {
          const result = await handleRelation(eventStore, relationId, (state) =>
            decide(
              {
                type: 'UpdateRelationInfo',
                data: {
                  relationId,
                  ...(kind !== undefined ? { kind } : {}),
                  ...('meta' in (req.body ?? {})
                    ? { meta: meta as RelationMeta | undefined }
                    : {}),
                },
              },
              state,
            ),
          );
          res
            .header('ETag', String(result.nextExpectedStreamVersion))
            .status(200)
            .json({ ok: true });
        } catch (error) {
          console.error('[relation] update conflict:', error);
          res.status(409).json({
            ok: false,
            error: 'conflict: relation not drawn or concurrent modification',
          });
        }
      },
    );

    router.delete(
      '/relations/:id',
      guard,
      async (req: Request, res: Response): Promise<void> => {
        const relationId = req.params.id;
        if (!relationId) {
          res.status(400).json({ error: 'missing id' });
          return;
        }
        try {
          const result = await handleRelation(eventStore, relationId, (state) =>
            decide({ type: 'RemoveRelation', data: { relationId } }, state),
          );
          res
            .header('ETag', String(result.nextExpectedStreamVersion))
            .status(200)
            .json({ ok: true });
        } catch (error) {
          console.error('[relation] remove conflict:', error);
          res.status(409).json({
            ok: false,
            error: 'conflict: relation not drawn or concurrent modification',
          });
        }
      },
    );

    router.get('/relations/:id', async (req: Request, res: Response): Promise<void> => {
      const doc = await documents
        .collection<RelationEdgeDoc>('relations_graph')
        .findOne({ _id: req.params.id });
      if (!doc) {
        res.status(404).json({ ok: false, error: 'not found' });
        return;
      }
      const { _id, modelId, fromId, toId, kind, meta } = doc;
      res.status(200).json({ _id, modelId, fromId, toId, kind, meta });
    });
  };
