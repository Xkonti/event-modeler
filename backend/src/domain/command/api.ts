import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import { decide, type CommandCommand } from './command.ts';
import { handleCommand } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for the command entity — identical shape to business-facts. Writes
 * go through the decider; a duplicate name surfaces as 409 (inline `entity_names`
 * rolls the append back). GET reads the async catalog. Mounted under `/api`
 * → `/api/commands*`. Writes guarded; GET open in v1.
 */
export const commandApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    const run = async (res: Response, id: string, command: CommandCommand) => {
      try {
        const result = await handleCommand(eventStore, id, (state) =>
          decide(command, state),
        );
        res
          .header('ETag', String(result.nextExpectedStreamVersion))
          .status(200)
          .json({ ok: true });
      } catch (error) {
        console.error('[command] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: name already in use or concurrent modification',
        });
      }
    };

    router.post('/commands', guard, (req: Request, res: Response) => {
      const { entityId, name, context } = req.body;
      void run(res, entityId, {
        type: 'DefineCommand',
        data: { entityId, name, context },
      });
    });

    router.put('/commands/:id/name', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      void run(res, entityId, {
        type: 'RenameCommand',
        data: { entityId, name: req.body.name },
      });
    });

    router.delete('/commands/:id', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      void run(res, entityId, {
        type: 'ArchiveCommand',
        data: { entityId },
      });
    });

    router.get(
      '/commands/:id',
      async (req: Request, res: Response): Promise<void> => {
        const doc = await documents
          .collection<CatalogEntry>('entity_catalog')
          .findOne({ _id: req.params.id });
        if (!doc) {
          res.status(404).json({ ok: false, error: 'not found' });
          return;
        }
        const { _id, entityType, name, context, archived } = doc;
        res.status(200).json({ _id, entityType, name, context, archived });
      },
    );
  };
