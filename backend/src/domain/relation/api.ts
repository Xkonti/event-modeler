import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import { isValidPair } from '../../shared/relationKind.ts';
import { decide } from './relation.ts';
import { handleRelation } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for relations. Drawing a relation first builds a transient decision
 * model from the catalog (both endpoints must exist, be unarchived, and form an
 * allowed directed type-pair) → else 422. Only then does the pure decider run
 * (within-stream: not-already-drawn) → 409 on conflict. Endpoint validity is
 * eventually-consistent (catalog read), acceptable single-user.
 *
 * Mounted under `/api` → `/api/relations*`. Writes guarded.
 */
export const relationApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    router.post(
      '/relations',
      guard,
      async (req: Request, res: Response): Promise<void> => {
        const { entityId, fromId, toId } = req.body;
        if (!entityId || !fromId || !toId) {
          res.status(400).json({ error: 'missing entityId/fromId/toId' });
          return;
        }

        const catalog = documents.collection<CatalogEntry>('entity_catalog');
        const [from, to] = await Promise.all([
          catalog.findOne({ _id: fromId }),
          catalog.findOne({ _id: toId }),
        ]);
        if (!from || from.archived || !to || to.archived) {
          res
            .status(422)
            .json({ ok: false, error: 'relation endpoint not found' });
          return;
        }
        if (!isValidPair(from.entityType, to.entityType)) {
          res
            .status(422)
            .json({ ok: false, error: 'invalid relation type pair' });
          return;
        }

        try {
          const result = await handleRelation(eventStore, entityId, (state) =>
            decide(
              { type: 'DrawRelation', data: { entityId, fromId, toId } },
              state,
            ),
          );
          res
            .header('ETag', String(result.nextExpectedStreamVersion))
            .status(200)
            .json({ ok: true });
        } catch (error) {
          console.error('[relation] draw conflict:', error);
          res.status(409).json({
            ok: false,
            error: 'conflict: relation already drawn or concurrent modification',
          });
        }
      },
    );

    router.delete(
      '/relations/:id',
      guard,
      async (req: Request, res: Response): Promise<void> => {
        const entityId = req.params.id;
        if (!entityId) {
          res.status(400).json({ error: 'missing id' });
          return;
        }
        try {
          const result = await handleRelation(eventStore, entityId, (state) =>
            decide({ type: 'RemoveRelation', data: { entityId } }, state),
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
  };
