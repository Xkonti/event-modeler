import { CommandHandler } from '@event-driven-io/emmett';
import { automationStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './automation.ts';

/**
 * Wires the automation decider to its stream (`automation-{entityId}`).
 * Optimistic concurrency on the stream version is automatic, with retry.
 */
export const handleAutomation = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: automationStreamId,
});
