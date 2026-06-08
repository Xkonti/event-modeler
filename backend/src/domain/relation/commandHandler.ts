import { CommandHandler } from '@event-driven-io/emmett';
import { relationStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './relation.ts';

/**
 * Wires the relation decider to its stream (`relation-{entityId}`). Emmett
 * re-reads + folds per command; optimistic concurrency is automatic.
 */
export const handleRelation = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: relationStreamId,
});
