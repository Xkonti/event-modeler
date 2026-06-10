import { pongoMultiStreamProjection } from '@event-driven-io/emmett-postgresql';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { ContextEvent } from '../domain/context/events.ts';

/**
 * READ MODEL — the per-model lane (context) list. One Pongo document per
 * context, built ASYNC from the global log (src/consumers.ts).
 *
 * `factCount` is NOT stored here: a lane re-assign (last-write-wins, E1) touches
 * TWO contexts (old −1, new +1) but a projection folds one document per event —
 * so the count is DERIVED at read time by counting catalog entries whose
 * `contextId` matches (the catalog is the single home of fact→lane pointers).
 */
export type ContextDoc = {
  _id: string;
  modelId: string;
  name: string;
  archived: boolean;
};

/** Pure fold — exported for unit testing without a database. */
export const evolveContexts = (
  document: ContextDoc | null,
  event: ReadEvent<ContextEvent>,
): ContextDoc | null => {
  switch (event.type) {
    case 'ContextDefined':
      return {
        _id: event.data.contextId,
        modelId: event.data.modelId,
        name: event.data.name,
        archived: false,
      };
    case 'ContextRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'ContextArchived':
      return document ? { ...document, archived: true } : null;
  }
};

export const contextsProjection = pongoMultiStreamProjection<ContextDoc, ContextEvent>({
  collectionName: 'contexts',
  canHandle: ['ContextDefined', 'ContextRenamed', 'ContextArchived'],
  getDocumentId: (event) => event.data.contextId,
  evolve: evolveContexts,
});
