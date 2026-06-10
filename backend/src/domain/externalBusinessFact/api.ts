import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import { decide, type ExternalBusinessFactCommand } from './externalBusinessFact.ts';
import { sanitizeFields } from '../../shared/fields.ts';
import { handleExternalBusinessFact } from './commandHandler.ts';
import { checkLaneAssignable } from '../context/assignmentChecks.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for the external-business-fact entity — same template as
 * business-facts (yellow rendering is a frontend concern; lane assignment is the
 * X1 chunk, same assign path as internal facts — O5). Duplicate name (per model,
 * across types) → 409 via the inline `entity_names` rollback. Mounted under
 * `/api` → `/api/external-business-facts*`. Writes guarded; GET open in v1.
 */
export const externalBusinessFactApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    const run = async (
      res: Response,
      id: string,
      command: ExternalBusinessFactCommand,
    ) => {
      try {
        const result = await handleExternalBusinessFact(eventStore, id, (state) =>
          decide(command, state),
        );
        res
          .header('ETag', String(result.nextExpectedStreamVersion))
          .status(200)
          .json({ ok: true });
      } catch (error) {
        console.error('[externalBusinessFact] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: name already in use or concurrent modification',
        });
      }
    };

    router.post('/external-business-facts', guard, (req: Request, res: Response) => {
      const { modelId, entityId, name, fields } = req.body ?? {};
      if (typeof modelId !== 'string' || modelId.length === 0)
        return void res.status(400).json({ ok: false, error: 'modelId required' });
      if (typeof entityId !== 'string' || entityId.length === 0)
        return void res.status(400).json({ ok: false, error: 'entityId required' });
      void run(res, entityId, {
        type: 'DefineExternalBusinessFact',
        data: { modelId, entityId, name, fields: sanitizeFields(fields) },
      });
    });

    router.put(
      '/external-business-facts/:id/name',
      guard,
      (req: Request, res: Response) => {
        const entityId = req.params.id;
        if (!entityId) return void res.status(400).json({ error: 'missing id' });
        void run(res, entityId, {
          type: 'RenameExternalBusinessFact',
          data: { entityId, name: req.body.name },
        });
      },
    );

    router.put(
      '/external-business-facts/:id/fields',
      guard,
      (req: Request, res: Response) => {
        const entityId = req.params.id;
        if (!entityId) return void res.status(400).json({ error: 'missing id' });
        const { fields } = req.body ?? {};
        void run(res, entityId, {
          type: 'UpdateExternalBusinessFactFields',
          data: { entityId, fields: sanitizeFields(fields) },
        });
      },
    );

    // Lane assignment (X1; same path as internal facts — O5). Cross-stream
    // context existence/model check → 422 before the decider.
    router.put(
      '/external-business-facts/:id/context',
      guard,
      async (req: Request, res: Response): Promise<void> => {
        const entityId = req.params.id;
        const { contextId } = req.body ?? {};
        if (!entityId || typeof contextId !== 'string' || contextId.length === 0) {
          res.status(400).json({ ok: false, error: 'missing id or contextId' });
          return;
        }
        const check = await checkLaneAssignable(entityId, contextId);
        if (!check.ok) {
          res.status(check.status).json({ ok: false, error: check.error });
          return;
        }
        await run(res, entityId, {
          type: 'AssignExternalBusinessFactToContext',
          data: { entityId, contextId },
        });
      },
    );

    router.delete(
      '/external-business-facts/:id/context',
      guard,
      (req: Request, res: Response) => {
        const entityId = req.params.id;
        if (!entityId) return void res.status(400).json({ error: 'missing id' });
        void run(res, entityId, {
          type: 'ClearExternalBusinessFactContext',
          data: { entityId },
        });
      },
    );

    router.delete(
      '/external-business-facts/:id',
      guard,
      (req: Request, res: Response) => {
        const entityId = req.params.id;
        if (!entityId) return void res.status(400).json({ error: 'missing id' });
        void run(res, entityId, {
          type: 'ArchiveExternalBusinessFact',
          data: { entityId },
        });
      },
    );

    router.get(
      '/external-business-facts/:id',
      async (req: Request, res: Response): Promise<void> => {
        const doc = await documents
          .collection<CatalogEntry>('entity_catalog')
          .findOne({ _id: req.params.id });
        if (!doc) {
          res.status(404).json({ ok: false, error: 'not found' });
          return;
        }
        const { _id, modelId, entityType, name, definition, archived, contextId } = doc;
        res
          .status(200)
          .json({ _id, modelId, entityType, name, definition, archived, contextId });
      },
    );
  };
