import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './relation.ts';

/**
 * Unit tests for the relation decider — within-stream invariants only. Type-pair
 * validity is an api-layer concern (needs the catalog) and is covered by the
 * integration test, not here.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const drawn = {
  type: 'RelationDrawn' as const,
  data: { entityId: 'r1', fromId: 'c1', toId: 'f1' },
};

describe('relation decider', () => {
  it('draws a relation from empty', () => {
    given([])
      .when({
        type: 'DrawRelation',
        data: { entityId: 'r1', fromId: 'c1', toId: 'f1' },
      })
      .then([drawn]);
  });

  it('rejects drawing an already-drawn relation', () => {
    given([drawn])
      .when({
        type: 'DrawRelation',
        data: { entityId: 'r1', fromId: 'c1', toId: 'f1' },
      })
      .thenThrows();
  });

  it('removes a drawn relation', () => {
    given([drawn])
      .when({ type: 'RemoveRelation', data: { entityId: 'r1' } })
      .then([{ type: 'RelationRemoved', data: { entityId: 'r1' } }]);
  });

  it('rejects removing a relation that is not drawn', () => {
    given([])
      .when({ type: 'RemoveRelation', data: { entityId: 'r1' } })
      .thenThrows();
  });

  it('rejects removing an already-removed relation', () => {
    given([drawn, { type: 'RelationRemoved', data: { entityId: 'r1' } }])
      .when({ type: 'RemoveRelation', data: { entityId: 'r1' } })
      .thenThrows();
  });
});
