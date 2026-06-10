import { pongoMultiStreamProjection } from '@event-driven-io/emmett-postgresql';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { ModelEvent } from '../domain/model/events.ts';
import type { SliceArchived, SliceDefined } from '../domain/slice/events.ts';

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
 * `sliceCount` is DERIVED (no dedicated fact): SliceDefined − SliceArchived,
 * scoped by `modelId` (S1). `lastEditedAt` was CUT from v1 — Emmett's read-event
 * metadata exposes positions, not a wall-clock timestamp, so it needs a
 * dedicated source; the W2 dashboard ships without it (decision at S2).
 */
export type ModelDoc = {
  _id: string;
  name: string;
  archived: boolean;
  sliceCount: number;
};

/** The events this projection folds: model lifecycle + the slice count signals. */
export type ModelsEvent = ModelEvent | SliceDefined | SliceArchived;

/** Pure fold — exported for unit testing without a database. */
export const evolveModels = (
  document: ModelDoc | null,
  event: ReadEvent<ModelsEvent>,
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
    // sliceCount is derived from the slice lifecycle, keyed by the event's
    // modelId. A slice event for an unknown model (out-of-order replay) is a
    // no-op — the count re-derives correctly on rebuild.
    case 'SliceDefined':
      return document ? { ...document, sliceCount: document.sliceCount + 1 } : null;
    case 'SliceArchived':
      return document
        ? { ...document, sliceCount: Math.max(0, document.sliceCount - 1) }
        : null;
  }
};

export const modelsProjection = pongoMultiStreamProjection<ModelDoc, ModelsEvent>({
  collectionName: 'models',
  canHandle: [
    'ModelCreated',
    'ModelRenamed',
    'ModelArchived',
    'SliceDefined',
    'SliceArchived',
  ],
  getDocumentId: (event) => event.data.modelId,
  evolve: evolveModels,
});
