import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import { decide, type BusinessFactCommand } from './businessFact.ts';
import { handleBusinessFact } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for the business-fact entity. Writes go through the decider +
 * command handler (per-entity stream); a duplicate name surfaces as a 409 when
 * the inline `entity_names` constraint rolls the append back. The read endpoint
 * queries the async catalog read model.
 *
 * WRITE routes (POST/PUT/DELETE) are guarded by `requireAuth(auth)` — no valid
 * session ⇒ 401 before any decider runs (notes/auth-architecture.md: guard
 * writes only in v1). The GET read endpoint stays OPEN in v1. `buildAuthApp` mounts this router
 * under `/api`, so the live paths are `/api/business-facts*`.
 */
export const businessFactApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    const run = async (
      res: Response,
      id: string,
      command: BusinessFactCommand,
    ) => {
      try {
        const result = await handleBusinessFact(eventStore, id, (state) =>
          decide(command, state),
        );
        res
          .header('ETag', String(result.nextExpectedStreamVersion))
          .status(200)
          .json({ ok: true });
      } catch (error) {
        // A duplicate name (entity_names constraint rolled the append back) or
        // an optimistic-concurrency conflict both land here. The skeleton maps
        // both to 409; distinguishing them cleanly (inspect PG error 23505 vs
        // version conflict) is a TODO — see README.
        //
        // Log the raw error server-side; the client body stays generic so PG
        // error text (table/column names) never reaches the wire.
        console.error('[businessFact] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: name already in use or concurrent modification',
        });
      }
    };

    router.post('/business-facts', guard, (req: Request, res: Response) => {
      const { entityId, name, context } = req.body;
      void run(res, entityId, {
        type: 'DefineBusinessFact',
        data: { entityId, name, context },
      });
    });

    router.put(
      '/business-facts/:id/name',
      guard,
      (req: Request, res: Response) => {
        const entityId = req.params.id;
        if (!entityId) return void res.status(400).json({ error: 'missing id' });
        void run(res, entityId, {
          type: 'RenameBusinessFact',
          data: { entityId, name: req.body.name },
        });
      },
    );

    router.delete(
      '/business-facts/:id',
      guard,
      (req: Request, res: Response) => {
        const entityId = req.params.id;
        if (!entityId) return void res.status(400).json({ error: 'missing id' });
        void run(res, entityId, {
          type: 'ArchiveBusinessFact',
          data: { entityId },
        });
      },
    );

    router.get(
      '/business-facts/:id',
      async (req: Request, res: Response): Promise<void> => {
        const doc = await documents
          .collection<CatalogEntry>('entity_catalog')
          .findOne({ _id: req.params.id });
        if (!doc) {
          res.status(404).json({ ok: false, error: 'not found' });
          return;
        }
        // Return a clean DTO — Pongo documents carry metadata (e.g. a BigInt
        // `_version`) that `res.json` cannot serialize.
        const { _id, entityType, name, context, archived } = doc;
        res.status(200).json({ _id, entityType, name, context, archived });
      },
    );
  };
