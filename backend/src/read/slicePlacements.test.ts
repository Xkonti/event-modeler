import { describe, expect, it } from 'bun:test';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { SliceEvent } from '../domain/slice/events.ts';
import { evolveSlicePlacements, type SlicePlacementsDoc } from './slicePlacements.ts';

/** Pure fold test — metadata is irrelevant, so cast minimal event shapes. */
const ev = (e: SliceEvent): ReadEvent<SliceEvent> => e as ReadEvent<SliceEvent>;

describe('evolveSlicePlacements', () => {
  it('creates an empty doc on SliceDefined', () => {
    const doc = evolveSlicePlacements(
      null,
      ev({ type: 'SliceDefined', data: { entityId: 's1', name: 'Checkout' } }),
    );
    expect(doc).toEqual({
      _id: 's1',
      name: 'Checkout',
      placements: [],
      archived: false,
    });
  });

  it('appends a placement on EntityPlaced', () => {
    const base: SlicePlacementsDoc = {
      _id: 's1',
      name: 'C',
      placements: [],
      archived: false,
    };
    const doc = evolveSlicePlacements(
      base,
      ev({
        type: 'EntityPlaced',
        data: { entityId: 's1', placedEntityId: 'e1', x: 10, y: 20 },
      }),
    );
    expect(doc?.placements).toEqual([{ placedEntityId: 'e1', x: 10, y: 20 }]);
  });

  it('updates coords on EntityMoved', () => {
    const base: SlicePlacementsDoc = {
      _id: 's1',
      placements: [{ placedEntityId: 'e1', x: 1, y: 1 }],
      archived: false,
    };
    const doc = evolveSlicePlacements(
      base,
      ev({
        type: 'EntityMoved',
        data: { entityId: 's1', placedEntityId: 'e1', x: 9, y: 9 },
      }),
    );
    expect(doc?.placements).toEqual([{ placedEntityId: 'e1', x: 9, y: 9 }]);
  });

  it('drops a placement on EntityRemovedFromSlice', () => {
    const base: SlicePlacementsDoc = {
      _id: 's1',
      placements: [{ placedEntityId: 'e1', x: 1, y: 1 }],
      archived: false,
    };
    const doc = evolveSlicePlacements(
      base,
      ev({
        type: 'EntityRemovedFromSlice',
        data: { entityId: 's1', placedEntityId: 'e1' },
      }),
    );
    expect(doc?.placements).toEqual([]);
  });

  it('marks archived on SliceArchived', () => {
    const base: SlicePlacementsDoc = {
      _id: 's1',
      placements: [],
      archived: false,
    };
    const doc = evolveSlicePlacements(
      base,
      ev({ type: 'SliceArchived', data: { entityId: 's1' } }),
    );
    expect(doc?.archived).toBe(true);
  });
});
