import { CommandHandler } from '@event-driven-io/emmett';
import { businessFactStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './businessFact.ts';

/**
 * Wires the decider to its stream. On each call Emmett re-reads the stream and
 * folds it via `evolve` (no snapshot cache — streams are short, so this is
 * cheap; notes/event-sourcing-architecture.md). Optimistic concurrency on the
 * stream version is automatic, with retry on conflict.
 */
export const handleBusinessFact = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: businessFactStreamId,
});
