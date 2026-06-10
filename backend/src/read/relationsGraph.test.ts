import { describe, expect, it } from 'bun:test';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { RelationEvent } from '../domain/relation/events.ts';
import {
  evolveRelationsGraph,
  type RelationEdgeDoc,
} from './relationsGraph.ts';

/** Unit tests for the relations-graph fold — pure, no database. */
const ev = (e: RelationEvent): ReadEvent<RelationEvent> =>
  e as ReadEvent<RelationEvent>;

const M = 'm-budget';

describe('evolveRelationsGraph', () => {
  it('creates an edge document with the stored kind + meta on RelationDrawn (F4)', () => {
    const doc = evolveRelationsGraph(
      null,
      ev({
        type: 'RelationDrawn',
        data: {
          modelId: M,
          relationId: 'r1',
          fromId: 'a',
          toId: 'b',
          kind: 'produces',
          meta: { note: 'x' },
        },
      }),
    );
    expect(doc).toEqual({
      _id: 'r1',
      modelId: M,
      fromId: 'a',
      toId: 'b',
      kind: 'produces',
      meta: { note: 'x' },
    });
  });

  it('replaces kind + meta on RelationInfoUpdated', () => {
    const existing: RelationEdgeDoc = {
      _id: 'r1',
      modelId: M,
      fromId: 'a',
      toId: 'b',
      kind: 'produces',
      meta: { note: 'x' },
    };
    const doc = evolveRelationsGraph(
      existing,
      ev({
        type: 'RelationInfoUpdated',
        data: {
          modelId: M,
          relationId: 'r1',
          fromId: 'a',
          toId: 'b',
          kind: 'produces',
          meta: { note: 'y' },
        },
      }),
    );
    expect(doc?.meta).toEqual({ note: 'y' });
  });

  it('deletes the document on RelationRemoved', () => {
    const existing: RelationEdgeDoc = {
      _id: 'r1',
      modelId: M,
      fromId: 'a',
      toId: 'b',
      kind: 'produces',
    };
    const doc = evolveRelationsGraph(
      existing,
      ev({ type: 'RelationRemoved', data: { modelId: M, relationId: 'r1' } }),
    );
    expect(doc).toBeNull();
  });
});
