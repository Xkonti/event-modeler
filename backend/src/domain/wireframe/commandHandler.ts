import { CommandHandler } from '@event-driven-io/emmett';
import { wireframeStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './wireframe.ts';

/**
 * Wires the wireframe decider to its stream (`wireframe-{entityId}`). Emmett
 * re-reads + folds the stream via `evolve` on each call; optimistic concurrency
 * on the stream version is automatic.
 */
export const handleWireframe = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: wireframeStreamId,
});
