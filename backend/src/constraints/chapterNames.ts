import { postgreSQLRawBatchSQLProjection } from '@event-driven-io/emmett-postgresql';
import { sql, type SQL } from '@event-driven-io/dumbo';
import { normalizeName } from '../shared/naming.ts';
import type { ChapterEvent } from '../domain/chapter/events.ts';

/**
 * CONSTRAINT projection — per-model CHAPTER-name uniqueness (C1). Chapters live
 * in their OWN namespace, separate from `entity_names` and `context_names`
 * (G-C2): a chapter may share its name with a fact or a lane, but not with
 * another chapter in the same model.
 *
 * Registered INLINE → runs in the SAME transaction as the event append. The
 * `chapter_names` `(model_id, normalized_name)` PRIMARY KEY rejects a colliding
 * name: the INSERT throws → the append tx rolls back → the command fails (409).
 * Archiving frees the name (G-C3). Table is created by src/schema.ts.
 */
export const chapterNamesConstraint = postgreSQLRawBatchSQLProjection<ChapterEvent>({
  name: 'chapter_names_constraint',
  canHandle: ['ChapterDefined', 'ChapterRenamed', 'ChapterArchived'],
  evolve: (events): SQL[] =>
    events.flatMap((event): SQL[] => {
      switch (event.type) {
        case 'ChapterDefined':
        case 'ChapterRenamed':
          return [
            sql('DELETE FROM chapter_names WHERE chapter_id = %L', event.data.chapterId),
            sql(
              `INSERT INTO chapter_names (model_id, normalized_name, chapter_id)
               VALUES (%L, %L, %L)`,
              event.data.modelId,
              normalizeName(event.data.name),
              event.data.chapterId,
            ),
          ];
        case 'ChapterArchived':
          return [
            sql('DELETE FROM chapter_names WHERE chapter_id = %L', event.data.chapterId),
          ];
      }
    }),
});
