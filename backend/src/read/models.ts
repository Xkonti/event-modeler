import { pongoMultiStreamProjection } from '@event-driven-io/emmett-postgresql';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { ModelEvent } from '../domain/model/events.ts';

/**
 * READ MODEL (not a constraint) — the model list the W2 dashboard queries. One
 * Pongo (JSONB) document per model, built ASYNC from the global event log via a
 * consumer (src/consumers.ts) → eventually consistent, rebuildable, never on the
 * write path.
 *
 * Litmus: if this were 5 minutes stale, no command would *wrongly succeed* —
 * only the dashboard would read stale data. That is what makes it a read model
 * (notes/constraint-inline-projection-pattern.md).
 *
 * `sliceCount` is DERIVED (no dedicated fact). At F0 it is always 0; the slice
 * fold (SliceDefined − SliceArchived, scoped by modelId) lands with the slice
 * vertical (S1), once slice events carry `modelId`. `lastEditedAt` is likewise
 * deferred — Emmett's read-event metadata exposes positions, not a wall-clock
 * timestamp, so it needs a dedicated source (added later).
 */
export type ModelDoc = {
  _id: string;
  name: string;
  archived: boolean;
  sliceCount: number;
};

/** Pure fold — exported for unit testing without a database. */
export const evolveModels = (
  document: ModelDoc | null,
  event: ReadEvent<ModelEvent>,
): ModelDoc | null => {
  switch (event.type) {
    case 'ModelCreated':
      return {
        _id: event.data.modelId,
        name: event.data.name,
        archived: false,
        sliceCount: 0,
      };
    case 'ModelRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'ModelArchived':
      return document ? { ...document, archived: true } : null;
  }
};

export const modelsProjection = pongoMultiStreamProjection<ModelDoc, ModelEvent>({
  collectionName: 'models',
  canHandle: ['ModelCreated', 'ModelRenamed', 'ModelArchived'],
  getDocumentId: (event) => event.data.modelId,
  evolve: evolveModels,
});
