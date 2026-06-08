import type { Event } from '@event-driven-io/emmett';

/**
 * Slice entity events. One stream per slice: `slice-{entityId}`. A slice is a
 * container that REFERENCES entities and records WHERE they sit (placements) —
 * it never holds entity definitions (those live in their own streams). Placement
 * position is presentation-only; structured snap layout is a frontend concern
 * (notes/model-structure.md, notes/layout-and-rendering.md).
 *
 * Placement uniqueness `(slice, placedEntity)` is a single-stream invariant — the
 * slice stream sees all its own placements — so it needs no inline constraint.
 */
export type SliceDefined = Event<'SliceDefined', { entityId: string; name?: string }>;

export type EntityPlaced = Event<
  'EntityPlaced',
  { entityId: string; placedEntityId: string; x: number; y: number }
>;

export type EntityMoved = Event<
  'EntityMoved',
  { entityId: string; placedEntityId: string; x: number; y: number }
>;

export type EntityRemovedFromSlice = Event<
  'EntityRemovedFromSlice',
  { entityId: string; placedEntityId: string }
>;

export type SliceRenamed = Event<'SliceRenamed', { entityId: string; name: string }>;

export type SliceArchived = Event<'SliceArchived', { entityId: string }>;

export type SliceEvent =
  | SliceDefined
  | EntityPlaced
  | EntityMoved
  | EntityRemovedFromSlice
  | SliceRenamed
  | SliceArchived;
