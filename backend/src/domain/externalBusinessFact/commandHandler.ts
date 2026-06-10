import { CommandHandler } from '@event-driven-io/emmett';
import { externalBusinessFactStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './externalBusinessFact.ts';

/**
 * Wires the external-business-fact decider to its stream
 * (`externalBusinessFact-{entityId}`). Emmett re-reads + folds the stream via
 * `evolve` on each call; optimistic concurrency on the stream version is
 * automatic.
 */
export const handleExternalBusinessFact = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: externalBusinessFactStreamId,
});
