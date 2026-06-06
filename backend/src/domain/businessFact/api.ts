import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import { decide, type BusinessFactCommand } from './businessFact.ts';
import { handleBusinessFact } from './commandHandler.ts';

/**
 * HTTP surface for the business-fact entity. Writes go through the decider +
 * command handler (per-entity stream); a duplicate name surfaces as a 409 when
 * the inline `entity_names` constraint rolls the append back. The read endpoint
 * queries the async catalog read model.
 */
export const businessFactApi =
  (eventStore: AppEventStore): WebApiSetup =>
  (router: Router) => {
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
        res.status(409).json({
          ok: false,
          error: 'conflict: name already in use or concurrent modification',
          detail: String(error),
        });
      }
    };

    router.post('/business-facts', (req: Request, res: Response) => {
      const { factId, name, context } = req.body;
      void run(res, factId, {
        type: 'DefineBusinessFact',
        data: { factId, name, context },
      });
    });

    router.put('/business-facts/:id/name', (req: Request, res: Response) => {
      const factId = req.params.id;
      if (!factId) return void res.status(400).json({ error: 'missing id' });
      void run(res, factId, {
        type: 'RenameBusinessFact',
        data: { factId, name: req.body.name },
      });
    });

    router.delete('/business-facts/:id', (req: Request, res: Response) => {
      const factId = req.params.id;
      if (!factId) return void res.status(400).json({ error: 'missing id' });
      void run(res, factId, {
        type: 'ArchiveBusinessFact',
        data: { factId },
      });
    });

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
