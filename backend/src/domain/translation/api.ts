import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';
import { decide, type TranslationCommand } from './translation.ts';
import type { Mapping } from './events.ts';
import { handleTranslation } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for translations — same template as the other catalog types with
 * the divergent `mapping` payload (G3). Which external fact / command a
 * translation connects to is expressed through RELATIONS (the 4th-pattern pairs),
 * not through the mapping payload — so no cross-stream ref pre-check here.
 *
 * Mounted under `/api` → `/api/translations*`. Writes guarded; GET open in v1.
 */

const parseMapping = (raw: unknown): Mapping | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const { direction, pairs } = raw as Record<string, unknown>;
  if (typeof direction !== 'string' || !Array.isArray(pairs)) return null;
  const parsedPairs = pairs.map((p) => {
    const { externalField, internalField } = (p ?? {}) as Record<string, unknown>;
    return {
      externalField: typeof externalField === 'string' ? externalField : '',
      internalField: typeof internalField === 'string' ? internalField : '',
    };
  });
  return { direction: direction as Mapping['direction'], pairs: parsedPairs };
};

export const translationApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    const run = async (res: Response, id: string, command: TranslationCommand) => {
      try {
        const result = await handleTranslation(eventStore, id, (state) =>
          decide(command, state),
        );
        res
          .header('ETag', String(result.nextExpectedStreamVersion))
          .status(200)
          .json({ ok: true });
      } catch (error) {
        console.error('[translation] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: name already in use or concurrent modification',
        });
      }
    };

    router.post('/translations', guard, (req: Request, res: Response) => {
      const { modelId, entityId, name } = req.body ?? {};
      if (typeof modelId !== 'string' || modelId.length === 0)
        return void res.status(400).json({ ok: false, error: 'modelId required' });
      if (typeof entityId !== 'string' || entityId.length === 0)
        return void res.status(400).json({ ok: false, error: 'entityId required' });
      const mapping = parseMapping(req.body?.mapping);
      if (!mapping)
        return void res.status(400).json({ ok: false, error: 'mapping required' });
      void run(res, entityId, {
        type: 'DefineTranslation',
        data: { modelId, entityId, name, mapping },
      });
    });

    router.put('/translations/:id/name', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      void run(res, entityId, {
        type: 'RenameTranslation',
        data: { entityId, name: req.body.name },
      });
    });

    router.put('/translations/:id/mapping', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      const mapping = parseMapping(req.body?.mapping);
      if (!mapping)
        return void res.status(400).json({ ok: false, error: 'mapping required' });
      void run(res, entityId, {
        type: 'UpdateTranslationMapping',
        data: { entityId, mapping },
      });
    });

    router.delete('/translations/:id', guard, (req: Request, res: Response) => {
      const entityId = req.params.id;
      if (!entityId) return void res.status(400).json({ error: 'missing id' });
      void run(res, entityId, { type: 'ArchiveTranslation', data: { entityId } });
    });

    router.get('/translations/:id', async (req: Request, res: Response): Promise<void> => {
      const doc = await documents
        .collection<CatalogEntry>('entity_catalog')
        .findOne({ _id: req.params.id });
      if (!doc) {
        res.status(404).json({ ok: false, error: 'not found' });
        return;
      }
      const { _id, modelId, entityType, name, definition, archived } = doc;
      res.status(200).json({ _id, modelId, entityType, name, definition, archived });
    });
  };
