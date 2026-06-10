import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Request, Response, Router } from 'express';
import type { AppEventStore } from '../../eventStore.ts';
import { documents } from '../../db.ts';
import type { ChapterDoc } from '../../read/chapters.ts';
import { decide, type ChapterCommand } from './chapter.ts';
import { handleChapter } from './commandHandler.ts';
import type { Auth } from '../../auth/auth.ts';
import { requireAuth } from '../../auth/requireAuth.ts';

/**
 * HTTP surface for chapters (C1 — the single-level organizing band). Writes go
 * through the decider; a duplicate chapter name (per model, chapters' own
 * namespace) surfaces as 409 when the inline `chapter_names` constraint rolls
 * the append back. The list read serves the band: chapters in creation order
 * (`definedAtPosition`, same convention as slice tiling).
 *
 * Slice→chapter ASSIGNMENT is the slice's API (`PUT /slices/:id/chapter`), not
 * here — the assignment fact lives on the slice stream (X1 mirror).
 *
 * Mounted under `/api` → `/api/chapters*` + `/api/models/:id/chapters`.
 * Writes guarded; GET open in v1.
 */
export const chapterApi =
  (eventStore: AppEventStore, auth: Auth): WebApiSetup =>
  (router: Router) => {
    const guard = requireAuth(auth);

    const run = async (res: Response, id: string, command: ChapterCommand) => {
      try {
        const result = await handleChapter(eventStore, id, (state) =>
          decide(command, state),
        );
        res
          .header('ETag', String(result.nextExpectedStreamVersion))
          .status(200)
          .json({ ok: true });
      } catch (error) {
        console.error('[chapter] write conflict:', error);
        res.status(409).json({
          ok: false,
          error: 'conflict: name already in use or concurrent modification',
        });
      }
    };

    router.post('/chapters', guard, (req: Request, res: Response) => {
      const { modelId, chapterId, name } = req.body ?? {};
      if (typeof modelId !== 'string' || modelId.length === 0)
        return void res.status(400).json({ ok: false, error: 'modelId required' });
      if (typeof chapterId !== 'string' || chapterId.length === 0)
        return void res.status(400).json({ ok: false, error: 'chapterId required' });
      void run(res, chapterId, {
        type: 'DefineChapter',
        data: { modelId, chapterId, name },
      });
    });

    router.put('/chapters/:id/name', guard, (req: Request, res: Response) => {
      const chapterId = req.params.id;
      if (!chapterId) return void res.status(400).json({ error: 'missing id' });
      void run(res, chapterId, {
        type: 'RenameChapter',
        data: { chapterId, name: req.body.name },
      });
    });

    router.delete('/chapters/:id', guard, (req: Request, res: Response) => {
      const chapterId = req.params.id;
      if (!chapterId) return void res.status(400).json({ error: 'missing id' });
      void run(res, chapterId, { type: 'ArchiveChapter', data: { chapterId } });
    });

    router.get('/chapters/:id', async (req: Request, res: Response): Promise<void> => {
      const doc = await documents
        .collection<ChapterDoc>('chapters')
        .findOne({ _id: req.params.id });
      if (!doc) {
        res.status(404).json({ ok: false, error: 'not found' });
        return;
      }
      const { _id, modelId, name, archived } = doc;
      res.status(200).json({ _id, modelId, name, archived });
    });

    // The model's chapter band, creation order (Pongo find has no sort — JS).
    router.get(
      '/models/:id/chapters',
      async (req: Request, res: Response): Promise<void> => {
        const docs = await documents
          .collection<ChapterDoc>('chapters')
          .find({ modelId: req.params.id, archived: false });
        const dto = docs
          .sort(
            (a, b) =>
              (a.definedAtPosition ?? Number.MAX_SAFE_INTEGER) -
                (b.definedAtPosition ?? Number.MAX_SAFE_INTEGER) ||
              a._id.localeCompare(b._id),
          )
          .map(({ _id, name }) => ({ _id, name }));
        res.status(200).json(dto);
      },
    );
  };
