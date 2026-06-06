import { CommandHandler } from '@event-driven-io/emmett';
import { userStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './user.ts';

/**
 * Wires the user decider to its stream (`user-{userId}`). Emmett re-reads + folds
 * the stream via `evolve` on each call, with automatic optimistic-concurrency
 * retry (notes/event-sourcing-architecture.md). The adapter calls this from
 * create/update/delete after encrypting PII.
 */
export const handleUser = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: userStreamId,
});
