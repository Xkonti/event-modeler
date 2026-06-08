import { pongoMultiStreamProjection } from '@event-driven-io/emmett-postgresql';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { RelationEvent } from '../domain/relation/events.ts';

/**
 * READ MODEL — the relations graph (one document per drawn relation), built ASYNC
 * from the global log. Stores ONLY the stable ids `{_id, fromId, toId}`; endpoint
 * TYPES and the derived `kind` are resolved at READ time by joining the catalog
 * (notes/event-sourcing-architecture.md). This keeps the read model fully
 * rebuildable from the log — no denormalized, drift-prone type/kind columns.
 *
 * `RelationRemoved` returns null → the document is deleted.
 */
export type RelationEdgeDoc = {
  _id: string;
  fromId: string;
  toId: string;
};

/** Pure fold — exported for unit testing without a database. */
export const evolveRelationsGraph = (
  document: RelationEdgeDoc | null,
  event: ReadEvent<RelationEvent>,
): RelationEdgeDoc | null => {
  switch (event.type) {
    case 'RelationDrawn':
      return {
        _id: event.data.entityId,
        fromId: event.data.fromId,
        toId: event.data.toId,
      };
    case 'RelationRemoved':
      return null;
    default:
      return document;
  }
};

export const relationsGraphProjection = pongoMultiStreamProjection<
  RelationEdgeDoc,
  RelationEvent
>({
  collectionName: 'relations_graph',
  canHandle: ['RelationDrawn', 'RelationRemoved'],
  getDocumentId: (event) => event.data.entityId,
  evolve: evolveRelationsGraph,
});
