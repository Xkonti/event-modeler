import { CommandHandler } from '@event-driven-io/emmett';
import { translationStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './translation.ts';

/**
 * Wires the translation decider to its stream (`translation-{entityId}`).
 * Optimistic concurrency on the stream version is automatic, with retry.
 */
export const handleTranslation = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: translationStreamId,
});
