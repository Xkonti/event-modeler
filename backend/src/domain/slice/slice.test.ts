import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './slice.ts';

/**
 * Unit tests for the slice decider — pure GIVEN events / WHEN command / THEN
 * events, no database. Exercises the within-stream placement invariants.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const defined = {
  type: 'SliceDefined' as const,
  data: { entityId: 's1', name: 'Checkout' },
};
const placed = {
  type: 'EntityPlaced' as const,
  data: { entityId: 's1', placedEntityId: 'e1', x: 10, y: 20 },
};
const archived = {
  type: 'SliceArchived' as const,
  data: { entityId: 's1' },
};

describe('slice decider', () => {
  it('defines a slice from empty', () => {
    given([])
      .when({ type: 'DefineSlice', data: { entityId: 's1', name: 'Checkout' } })
      .then([defined]);
  });

  it('rejects defining an already-defined slice', () => {
    given([defined])
      .when({ type: 'DefineSlice', data: { entityId: 's1' } })
      .thenThrows();
  });

  it('places an entity on an active slice', () => {
    given([defined])
      .when({
        type: 'PlaceEntity',
        data: { entityId: 's1', placedEntityId: 'e1', x: 10, y: 20 },
      })
      .then([placed]);
  });

  it('rejects placing on an undefined slice', () => {
    given([])
      .when({
        type: 'PlaceEntity',
        data: { entityId: 's1', placedEntityId: 'e1', x: 0, y: 0 },
      })
      .thenThrows();
  });

  it('rejects placing the same entity twice', () => {
    given([defined, placed])
      .when({
        type: 'PlaceEntity',
        data: { entityId: 's1', placedEntityId: 'e1', x: 5, y: 5 },
      })
      .thenThrows();
  });

  it('moves a placed entity', () => {
    given([defined, placed])
      .when({
        type: 'MoveEntity',
        data: { entityId: 's1', placedEntityId: 'e1', x: 99, y: 99 },
      })
      .then([
        {
          type: 'EntityMoved',
          data: { entityId: 's1', placedEntityId: 'e1', x: 99, y: 99 },
        },
      ]);
  });

  it('rejects moving an unplaced entity', () => {
    given([defined])
      .when({
        type: 'MoveEntity',
        data: { entityId: 's1', placedEntityId: 'eX', x: 0, y: 0 },
      })
      .thenThrows();
  });

  it('removes a placed entity', () => {
    given([defined, placed])
      .when({
        type: 'RemoveEntityFromSlice',
        data: { entityId: 's1', placedEntityId: 'e1' },
      })
      .then([
        {
          type: 'EntityRemovedFromSlice',
          data: { entityId: 's1', placedEntityId: 'e1' },
        },
      ]);
  });

  it('rejects removing an unplaced entity', () => {
    given([defined])
      .when({
        type: 'RemoveEntityFromSlice',
        data: { entityId: 's1', placedEntityId: 'eX' },
      })
      .thenThrows();
  });

  it('rejects placing on an archived slice', () => {
    given([defined, archived])
      .when({
        type: 'PlaceEntity',
        data: { entityId: 's1', placedEntityId: 'e2', x: 0, y: 0 },
      })
      .thenThrows();
  });

  it('renames an active slice', () => {
    given([defined])
      .when({ type: 'RenameSlice', data: { entityId: 's1', name: 'Pay' } })
      .then([{ type: 'SliceRenamed', data: { entityId: 's1', name: 'Pay' } }]);
  });

  it('archives an active slice', () => {
    given([defined])
      .when({ type: 'ArchiveSlice', data: { entityId: 's1' } })
      .then([archived]);
  });

  it('rejects archiving an already-archived slice', () => {
    given([defined, archived])
      .when({ type: 'ArchiveSlice', data: { entityId: 's1' } })
      .thenThrows();
  });
});
