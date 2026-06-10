import { CommandHandler } from '@event-driven-io/emmett';
import { chapterStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './chapter.ts';

/**
 * Wires the chapter decider to its stream (`chapter-{chapterId}`). Emmett
 * re-reads + folds the stream per command; optimistic concurrency on the stream
 * version is automatic, with retry on conflict.
 */
export const handleChapter = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: chapterStreamId,
});
