import type { Event } from '@event-driven-io/emmett';
import type { EntityType } from '../../shared/streams.ts';
import type { SlotRole } from '../../shared/slotRoles.ts';

/**
 * Slice entity events. One stream per slice: `slice-{sliceId}`. A slice is a
 * container that REFERENCES entities and records WHERE they sit (placements) —
 * it never holds entity definitions (those live in their own streams). Every
 * event carries `modelId` (F1).
 *
 * Placement is the snap-slot model (F3): `slotRole` is the band computed from
 * the entity's type, `slot` orders multi-cardinality bands (omitted for
 * command/automation/translation — one each per slice). The LANE is NOT here —
 * it derives from the catalog's `contextId` at render time. `entityType` is
 * recorded so cardinality folds from the stream alone on replay.
 *
 * Placement uniqueness `(slice, placedEntity)` is a single-stream invariant —
 * the slice stream sees all its own placements — so it needs no inline constraint.
 */
export type SliceDefined = Event<
  'SliceDefined',
  { modelId: string; sliceId: string; name?: string }
>;

export type EntityPlaced = Event<
  'EntityPlaced',
  {
    modelId: string;
    sliceId: string;
    placedEntityId: string;
    entityType: EntityType;
    slotRole: SlotRole;
    slot?: number;
  }
>;

export type EntitySlotsSwapped = Event<
  'EntitySlotsSwapped',
  { modelId: string; sliceId: string; entityIdA: string; entityIdB: string }
>;

export type EntityRemovedFromSlice = Event<
  'EntityRemovedFromSlice',
  { modelId: string; sliceId: string; placedEntityId: string }
>;

export type SliceRenamed = Event<
  'SliceRenamed',
  { modelId: string; sliceId: string; name: string }
>;

export type SliceArchived = Event<
  'SliceArchived',
  { modelId: string; sliceId: string }
>;

/**
 * Chapter assignment (C1) — lives on the SLICE's stream, exactly like a fact's
 * lane assignment lives on the fact (X1): the chapter is a property of the
 * slice, last-write-wins on re-assign (E1 mirror). `previousChapterId` is
 * stamped from state so per-chapter membership consumers see the chapter being
 * vacated without replaying the whole stream.
 */
export type SliceAssignedToChapter = Event<
  'SliceAssignedToChapter',
  { modelId: string; sliceId: string; chapterId: string; previousChapterId?: string }
>;

export type SliceChapterCleared = Event<
  'SliceChapterCleared',
  { modelId: string; sliceId: string; previousChapterId?: string }
>;

export type SliceEvent =
  | SliceDefined
  | EntityPlaced
  | EntitySlotsSwapped
  | EntityRemovedFromSlice
  | SliceRenamed
  | SliceArchived
  | SliceAssignedToChapter
  | SliceChapterCleared;
