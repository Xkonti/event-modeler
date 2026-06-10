import { CommandHandler } from '@event-driven-io/emmett';
import { scenarioStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './scenario.ts';

/**
 * Wires the scenario decider to its stream (`scenario-{scenarioId}`).
 * Optimistic concurrency on the stream version is automatic, with retry.
 */
export const handleScenario = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: scenarioStreamId,
});
