import { CommandHandler } from '@event-driven-io/emmett';
import { contextStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './context.ts';

/**
 * Wires the context decider to its stream (`context-{contextId}`). Emmett
 * re-reads + folds the stream per command; optimistic concurrency on the stream
 * version is automatic, with retry on conflict.
 */
export const handleContext = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: contextStreamId,
});
