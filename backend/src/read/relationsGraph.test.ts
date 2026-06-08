import { describe, expect, it } from 'bun:test';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { RelationEvent } from '../domain/relation/events.ts';
import {
  evolveRelationsGraph,
  type RelationEdgeDoc,
} from './relationsGraph.ts';

const ev = (e: RelationEvent): ReadEvent<RelationEvent> =>
  e as ReadEvent<RelationEvent>;

describe('evolveRelationsGraph', () => {
  it('creates an edge doc on RelationDrawn', () => {
    const doc = evolveRelationsGraph(
      null,
      ev({
        type: 'RelationDrawn',
        data: { entityId: 'r1', fromId: 'c1', toId: 'f1' },
      }),
    );
    expect(doc).toEqual({ _id: 'r1', fromId: 'c1', toId: 'f1' });
  });

  it('drops the doc on RelationRemoved', () => {
    const base: RelationEdgeDoc = { _id: 'r1', fromId: 'c1', toId: 'f1' };
    const doc = evolveRelationsGraph(
      base,
      ev({ type: 'RelationRemoved', data: { entityId: 'r1' } }),
    );
    expect(doc).toBeNull();
  });
});
