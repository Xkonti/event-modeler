import { CommandHandler } from '@event-driven-io/emmett';
import { readModelStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './readModel.ts';

/**
 * Wires the read-model-entity decider to its stream (`readModel-{entityId}`).
 * Emmett re-reads + folds the stream via `evolve` on each call; optimistic
 * concurrency on the stream version is automatic.
 */
export const handleReadModel = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: readModelStreamId,
});
