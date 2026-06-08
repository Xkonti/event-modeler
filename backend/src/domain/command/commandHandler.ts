import { CommandHandler } from '@event-driven-io/emmett';
import { commandStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './command.ts';

/**
 * Wires the command-entity decider to its stream (`command-{entityId}`). Emmett
 * re-reads + folds per command; optimistic concurrency is automatic.
 */
export const handleCommand = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: commandStreamId,
});
