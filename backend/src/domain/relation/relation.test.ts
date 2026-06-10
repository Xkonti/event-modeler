import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './relation.ts';

/**
 * Unit tests for the relation decider — within-stream invariants (drawn once,
 * edit/remove only while drawn, kind non-blank, modelId/endpoints stamped from
 * state on mutations). The 11-pair allow-list + same-model checks are the API
 * edge; the duplicate-(from,to,kind) rule (E3) is the inline `relation_pairs`
 * constraint — both integration-tested.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const M = 'm-budget';
const drawn = {
  type: 'RelationDrawn' as const,
  data: {
    modelId: M,
    relationId: 'r1',
    fromId: 'cmd1',
    toId: 'fact1',
    kind: 'produces',
    meta: undefined,
  },
};

describe('relation decider', () => {
  it('draws a relation with a stored kind (F4)', () => {
    given([])
      .when({ type: 'DrawRelation', data: drawn.data })
      .then([drawn]);
  });

  it('rejects a blank kind', () => {
    given([])
      .when({
        type: 'DrawRelation',
        data: { ...drawn.data, kind: '  ' },
      })
      .thenThrows();
  });

  it('rejects drawing the same relation twice', () => {
    given([drawn])
      .when({ type: 'DrawRelation', data: drawn.data })
      .thenThrows();
  });

  it('updates meta, stamping modelId/endpoints/kind from state', () => {
    given([drawn])
      .when({
        type: 'UpdateRelationInfo',
        data: { relationId: 'r1', meta: { note: 'maps total → amount' } },
      })
      .then([
        {
          type: 'RelationInfoUpdated',
          data: {
            modelId: M,
            relationId: 'r1',
            fromId: 'cmd1',
            toId: 'fact1',
            kind: 'produces',
            meta: { note: 'maps total → amount' },
          },
        },
      ]);
  });

  it('updates kind while preserving meta when meta not given', () => {
    given([
      drawn,
      {
        type: 'RelationInfoUpdated',
        data: {
          modelId: M,
          relationId: 'r1',
          fromId: 'cmd1',
          toId: 'fact1',
          kind: 'produces',
          meta: { note: 'keep me' },
        },
      },
    ])
      .when({ type: 'UpdateRelationInfo', data: { relationId: 'r1', kind: 'produces' } })
      .then([
        {
          type: 'RelationInfoUpdated',
          data: {
            modelId: M,
            relationId: 'r1',
            fromId: 'cmd1',
            toId: 'fact1',
            kind: 'produces',
            meta: { note: 'keep me' },
          },
        },
      ]);
  });

  it('rejects updating a relation that is not drawn (G-C4)', () => {
    given([])
      .when({ type: 'UpdateRelationInfo', data: { relationId: 'r1', meta: {} } })
      .thenThrows();
  });

  it('removes a drawn relation', () => {
    given([drawn])
      .when({ type: 'RemoveRelation', data: { relationId: 'r1' } })
      .then([
        { type: 'RelationRemoved', data: { modelId: M, relationId: 'r1' } },
      ]);
  });

  it('rejects removing an already-removed relation', () => {
    given([drawn, { type: 'RelationRemoved', data: { modelId: M, relationId: 'r1' } }])
      .when({ type: 'RemoveRelation', data: { relationId: 'r1' } })
      .thenThrows();
  });
});
