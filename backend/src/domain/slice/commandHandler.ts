import { CommandHandler } from '@event-driven-io/emmett';
import { sliceStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './slice.ts';

/**
 * Wires the slice decider to its stream (`slice-{entityId}`). Emmett re-reads +
 * folds the stream per command; optimistic concurrency on the stream version is
 * automatic, with retry on conflict.
 */
export const handleSlice = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: sliceStreamId,
});
