import { CommandHandler } from '@event-driven-io/emmett';
import { modelStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './model.ts';

/**
 * Wires the model decider to its stream (`model-{modelId}`). Emmett re-reads +
 * folds the stream via `evolve` on each call (no snapshot cache — streams are
 * short). Optimistic concurrency on the stream version is automatic.
 */
export const handleModel = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: modelStreamId,
});
