import { pongoMultiStreamProjection } from '@event-driven-io/emmett-postgresql';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { RelationEvent, RelationMeta } from '../domain/relation/events.ts';

/**
 * READ MODEL — the relations graph (one document per drawn relation), built ASYNC
 * from the global log. Stores the stable ids plus the STORED `kind` and the open
 * `meta` bag (F4) — kind is event data now, not a derivation, so the document
 * carries it verbatim and stays fully rebuildable. Endpoint names/types are
 * still resolved at read time by joining the catalog.
 *
 * `RelationRemoved` returns null → the document is deleted.
 */
export type RelationEdgeDoc = {
  _id: string;
  modelId: string;
  fromId: string;
  toId: string;
  kind: string;
  meta?: RelationMeta;
};

/** Pure fold — exported for unit testing without a database. */
export const evolveRelationsGraph = (
  document: RelationEdgeDoc | null,
  event: ReadEvent<RelationEvent>,
): RelationEdgeDoc | null => {
  switch (event.type) {
    case 'RelationDrawn': {
      const { modelId, relationId, fromId, toId, kind, meta } = event.data;
      return { _id: relationId, modelId, fromId, toId, kind, meta };
    }
    case 'RelationInfoUpdated':
      return document
        ? { ...document, kind: event.data.kind, meta: event.data.meta }
        : null;
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
  canHandle: ['RelationDrawn', 'RelationInfoUpdated', 'RelationRemoved'],
  getDocumentId: (event) => event.data.relationId,
  evolve: evolveRelationsGraph,
});
