import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './slice.ts';

/**
 * Unit tests for the slice decider — pure GIVEN events / WHEN command / THEN
 * events, no database. Exercises the F3 snap-slot invariants: computed band +
 * appended slot, single-cardinality types (one command/automation/translation
 * per slice), same-band slotted swaps, placement uniqueness, archive terminal.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const M = 'm-budget';
const defined = {
  type: 'SliceDefined' as const,
  data: { modelId: M, sliceId: 's1', name: 'Checkout' },
};
const factPlaced = {
  type: 'EntityPlaced' as const,
  data: {
    modelId: M,
    sliceId: 's1',
    placedEntityId: 'f1',
    entityType: 'businessFact' as const,
    slotRole: 'fact' as const,
    slot: 0,
  },
};
const commandPlaced = {
  type: 'EntityPlaced' as const,
  data: {
    modelId: M,
    sliceId: 's1',
    placedEntityId: 'c1',
    entityType: 'command' as const,
    slotRole: 'command' as const,
    slot: undefined,
  },
};

describe('slice decider', () => {
  it('defines a slice (name optional)', () => {
    given([])
      .when({ type: 'DefineSlice', data: { modelId: M, sliceId: 's1' } })
      .then([{ type: 'SliceDefined', data: { modelId: M, sliceId: 's1', name: undefined } }]);
  });

  it('rejects defining a slice twice', () => {
    given([defined])
      .when({ type: 'DefineSlice', data: { modelId: M, sliceId: 's1' } })
      .thenThrows();
  });

  it('places a fact into the fact band at slot 0 (F3)', () => {
    given([defined])
      .when({
        type: 'PlaceEntity',
        data: { sliceId: 's1', placedEntityId: 'f1', entityType: 'businessFact' },
      })
      .then([factPlaced]);
  });

  it('appends the next fact below (slot 1), independent of other bands', () => {
    given([defined, factPlaced, commandPlaced])
      .when({
        type: 'PlaceEntity',
        data: { sliceId: 's1', placedEntityId: 'f2', entityType: 'externalBusinessFact' },
      })
      .then([
        {
          type: 'EntityPlaced',
          data: {
            modelId: M,
            sliceId: 's1',
            placedEntityId: 'f2',
            entityType: 'externalBusinessFact',
            slotRole: 'fact',
            slot: 1,
          },
        },
      ]);
  });

  it('places a command without a slot (single-cardinality)', () => {
    given([defined])
      .when({
        type: 'PlaceEntity',
        data: { sliceId: 's1', placedEntityId: 'c1', entityType: 'command' },
      })
      .then([commandPlaced]);
  });

  it('rejects a SECOND command on the same slice (band cardinality)', () => {
    given([defined, commandPlaced])
      .when({
        type: 'PlaceEntity',
        data: { sliceId: 's1', placedEntityId: 'c2', entityType: 'command' },
      })
      .thenThrows();
  });

  it('allows an automation alongside a wireframe in the trigger band', () => {
    given([
      defined,
      {
        type: 'EntityPlaced',
        data: {
          modelId: M,
          sliceId: 's1',
          placedEntityId: 'w1',
          entityType: 'wireframe',
          slotRole: 'trigger',
          slot: 0,
        },
      },
    ])
      .when({
        type: 'PlaceEntity',
        data: { sliceId: 's1', placedEntityId: 'a1', entityType: 'automation' },
      })
      .then([
        {
          type: 'EntityPlaced',
          data: {
            modelId: M,
            sliceId: 's1',
            placedEntityId: 'a1',
            entityType: 'automation',
            slotRole: 'trigger',
            slot: undefined,
          },
        },
      ]);
  });

  it('rejects placing the same entity twice', () => {
    given([defined, factPlaced])
      .when({
        type: 'PlaceEntity',
        data: { sliceId: 's1', placedEntityId: 'f1', entityType: 'businessFact' },
      })
      .thenThrows();
  });

  it('rejects placing a non-placeable type (the model root)', () => {
    given([defined])
      .when({
        type: 'PlaceEntity',
        data: { sliceId: 's1', placedEntityId: 'm1', entityType: 'model' },
      })
      .thenThrows();
  });

  it('swaps slots of two facts in the same band', () => {
    given([
      defined,
      factPlaced,
      {
        type: 'EntityPlaced',
        data: {
          modelId: M,
          sliceId: 's1',
          placedEntityId: 'f2',
          entityType: 'businessFact',
          slotRole: 'fact',
          slot: 1,
        },
      },
    ])
      .when({
        type: 'SwapEntitySlots',
        data: { sliceId: 's1', entityIdA: 'f1', entityIdB: 'f2' },
      })
      .then([
        {
          type: 'EntitySlotsSwapped',
          data: { modelId: M, sliceId: 's1', entityIdA: 'f1', entityIdB: 'f2' },
        },
      ]);
  });

  it('rejects a swap across bands (F3)', () => {
    given([
      defined,
      factPlaced,
      {
        type: 'EntityPlaced',
        data: {
          modelId: M,
          sliceId: 's1',
          placedEntityId: 'r1',
          entityType: 'readModel',
          slotRole: 'readModel',
          slot: 0,
        },
      },
    ])
      .when({
        type: 'SwapEntitySlots',
        data: { sliceId: 's1', entityIdA: 'f1', entityIdB: 'r1' },
      })
      .thenThrows();
  });

  it('rejects a swap involving an unslotted (single) placement', () => {
    given([
      defined,
      commandPlaced,
      {
        type: 'EntityPlaced',
        data: {
          modelId: M,
          sliceId: 's1',
          placedEntityId: 'a1',
          entityType: 'automation',
          slotRole: 'trigger',
          slot: undefined,
        },
      },
      {
        type: 'EntityPlaced',
        data: {
          modelId: M,
          sliceId: 's1',
          placedEntityId: 'w1',
          entityType: 'wireframe',
          slotRole: 'trigger',
          slot: 0,
        },
      },
    ])
      .when({
        type: 'SwapEntitySlots',
        data: { sliceId: 's1', entityIdA: 'a1', entityIdB: 'w1' },
      })
      .thenThrows();
  });

  it('removes a placed entity', () => {
    given([defined, factPlaced])
      .when({
        type: 'RemoveEntityFromSlice',
        data: { sliceId: 's1', placedEntityId: 'f1' },
      })
      .then([
        {
          type: 'EntityRemovedFromSlice',
          data: { modelId: M, sliceId: 's1', placedEntityId: 'f1' },
        },
      ]);
  });

  it('rejects removing an entity that is not placed', () => {
    given([defined])
      .when({
        type: 'RemoveEntityFromSlice',
        data: { sliceId: 's1', placedEntityId: 'ghost' },
      })
      .thenThrows();
  });

  it('frees the spot after removal — placing again works (slot re-appended)', () => {
    given([
      defined,
      factPlaced,
      {
        type: 'EntityRemovedFromSlice',
        data: { modelId: M, sliceId: 's1', placedEntityId: 'f1' },
      },
    ])
      .when({
        type: 'PlaceEntity',
        data: { sliceId: 's1', placedEntityId: 'f1', entityType: 'businessFact' },
      })
      .then([factPlaced]);
  });

  it('archives an active slice', () => {
    given([defined])
      .when({ type: 'ArchiveSlice', data: { sliceId: 's1' } })
      .then([{ type: 'SliceArchived', data: { modelId: M, sliceId: 's1' } }]);
  });

  it('rejects placing on an archived slice', () => {
    given([defined, { type: 'SliceArchived', data: { modelId: M, sliceId: 's1' } }])
      .when({
        type: 'PlaceEntity',
        data: { sliceId: 's1', placedEntityId: 'f1', entityType: 'businessFact' },
      })
      .thenThrows();
  });

  // C1 — chapter assignment (one per slice, last-write-wins; X1/E1 mirror)
  it('assigns an active slice to a chapter (C1)', () => {
    given([defined])
      .when({ type: 'AssignSliceToChapter', data: { sliceId: 's1', chapterId: 'ch1' } })
      .then([
        {
          type: 'SliceAssignedToChapter',
          data: { modelId: M, sliceId: 's1', chapterId: 'ch1' },
        },
      ]);
  });

  it('re-assigns last-write-wins, stamping previousChapterId (C1/E1)', () => {
    given([
      defined,
      {
        type: 'SliceAssignedToChapter',
        data: { modelId: M, sliceId: 's1', chapterId: 'ch1' },
      },
    ])
      .when({ type: 'AssignSliceToChapter', data: { sliceId: 's1', chapterId: 'ch2' } })
      .then([
        {
          type: 'SliceAssignedToChapter',
          data: { modelId: M, sliceId: 's1', chapterId: 'ch2', previousChapterId: 'ch1' },
        },
      ]);
  });

  it('clears an assigned chapter (C1)', () => {
    given([
      defined,
      {
        type: 'SliceAssignedToChapter',
        data: { modelId: M, sliceId: 's1', chapterId: 'ch1' },
      },
    ])
      .when({ type: 'ClearSliceChapter', data: { sliceId: 's1' } })
      .then([
        {
          type: 'SliceChapterCleared',
          data: { modelId: M, sliceId: 's1', previousChapterId: 'ch1' },
        },
      ]);
  });

  it('rejects clearing when no chapter is assigned (C1)', () => {
    given([defined])
      .when({ type: 'ClearSliceChapter', data: { sliceId: 's1' } })
      .thenThrows();
  });

  it('rejects assigning an archived slice to a chapter (G-C5)', () => {
    given([defined, { type: 'SliceArchived', data: { modelId: M, sliceId: 's1' } }])
      .when({ type: 'AssignSliceToChapter', data: { sliceId: 's1', chapterId: 'ch1' } })
      .thenThrows();
  });
});
