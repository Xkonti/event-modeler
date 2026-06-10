import { describe, expect, it } from 'bun:test';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { SliceEvent } from '../domain/slice/events.ts';
import { evolveSlicePlacements, type SlicePlacementsDoc } from './slicePlacements.ts';

/** Pure fold test — metadata is irrelevant, so cast minimal event shapes. */
const ev = (e: SliceEvent): ReadEvent<SliceEvent> => e as ReadEvent<SliceEvent>;

const M = 'm-budget';

describe('evolveSlicePlacements', () => {
  it('creates an empty doc on SliceDefined (with modelId)', () => {
    const doc = evolveSlicePlacements(
      null,
      ev({ type: 'SliceDefined', data: { modelId: M, sliceId: 's1', name: 'Checkout' } }),
    );
    expect(doc).toEqual({
      _id: 's1',
      modelId: M,
      name: 'Checkout',
      placements: [],
      archived: false,
    });
  });

  it('appends a snap-slot placement on EntityPlaced (F3)', () => {
    const base: SlicePlacementsDoc = {
      _id: 's1',
      modelId: M,
      name: 'Checkout',
      placements: [],
      archived: false,
    };
    const doc = evolveSlicePlacements(
      base,
      ev({
        type: 'EntityPlaced',
        data: {
          modelId: M,
          sliceId: 's1',
          placedEntityId: 'f1',
          entityType: 'businessFact',
          slotRole: 'fact',
          slot: 0,
        },
      }),
    );
    expect(doc?.placements).toEqual([
      { placedEntityId: 'f1', entityType: 'businessFact', slotRole: 'fact', slot: 0 },
    ]);
  });

  it('swaps slot numbers on EntitySlotsSwapped', () => {
    const base: SlicePlacementsDoc = {
      _id: 's1',
      modelId: M,
      placements: [
        { placedEntityId: 'f1', entityType: 'businessFact', slotRole: 'fact', slot: 0 },
        { placedEntityId: 'f2', entityType: 'businessFact', slotRole: 'fact', slot: 1 },
      ],
      archived: false,
    };
    const doc = evolveSlicePlacements(
      base,
      ev({
        type: 'EntitySlotsSwapped',
        data: { modelId: M, sliceId: 's1', entityIdA: 'f1', entityIdB: 'f2' },
      }),
    );
    expect(doc?.placements.find((p) => p.placedEntityId === 'f1')?.slot).toBe(1);
    expect(doc?.placements.find((p) => p.placedEntityId === 'f2')?.slot).toBe(0);
  });

  it('drops the placement on EntityRemovedFromSlice', () => {
    const base: SlicePlacementsDoc = {
      _id: 's1',
      modelId: M,
      placements: [
        { placedEntityId: 'f1', entityType: 'businessFact', slotRole: 'fact', slot: 0 },
      ],
      archived: false,
    };
    const doc = evolveSlicePlacements(
      base,
      ev({
        type: 'EntityRemovedFromSlice',
        data: { modelId: M, sliceId: 's1', placedEntityId: 'f1' },
      }),
    );
    expect(doc?.placements).toEqual([]);
  });

  it('renames and archives', () => {
    const base: SlicePlacementsDoc = {
      _id: 's1',
      modelId: M,
      name: 'Old',
      placements: [],
      archived: false,
    };
    const renamed = evolveSlicePlacements(
      base,
      ev({ type: 'SliceRenamed', data: { modelId: M, sliceId: 's1', name: 'New' } }),
    );
    expect(renamed?.name).toBe('New');
    const archived = evolveSlicePlacements(
      renamed,
      ev({ type: 'SliceArchived', data: { modelId: M, sliceId: 's1' } }),
    );
    expect(archived?.archived).toBe(true);
  });

  it('folds chapter assignment + clear (C1, last-write-wins)', () => {
    const base: SlicePlacementsDoc = {
      _id: 's1',
      modelId: M,
      name: 'Checkout',
      placements: [],
      archived: false,
    };
    const assigned = evolveSlicePlacements(
      base,
      ev({
        type: 'SliceAssignedToChapter',
        data: { modelId: M, sliceId: 's1', chapterId: 'ch1' },
      }),
    );
    expect(assigned?.chapterId).toBe('ch1');
    const reassigned = evolveSlicePlacements(
      assigned,
      ev({
        type: 'SliceAssignedToChapter',
        data: { modelId: M, sliceId: 's1', chapterId: 'ch2', previousChapterId: 'ch1' },
      }),
    );
    expect(reassigned?.chapterId).toBe('ch2');
    const cleared = evolveSlicePlacements(
      reassigned,
      ev({
        type: 'SliceChapterCleared',
        data: { modelId: M, sliceId: 's1', previousChapterId: 'ch2' },
      }),
    );
    expect(cleared?.chapterId).toBeUndefined();
  });
});
