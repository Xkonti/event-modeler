import { pongoMultiStreamProjection } from '@event-driven-io/emmett-postgresql';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { SliceEvent } from '../domain/slice/events.ts';
import type { EntityType } from '../shared/streams.ts';
import type { SlotRole } from '../shared/slotRoles.ts';

/**
 * READ MODEL (not a constraint) — one document per slice holding its placement
 * list in the snap-slot shape (F3), built ASYNC from the global log
 * (src/consumers.ts). The canvas GET joins this with `entity_catalog` to resolve
 * each placed entity's name/type/definition and lane (`contextId`).
 *
 * Slots never gate a write (the slice decider owns placement invariants from its
 * own stream), so this is a read model by definition. See
 * notes/constraint-inline-projection-pattern.md.
 */
export type SlicePlacement = {
  placedEntityId: string;
  entityType: EntityType;
  slotRole: SlotRole;
  slot?: number;
};

export type SlicePlacementsDoc = {
  _id: string;
  modelId: string;
  name?: string;
  placements: SlicePlacement[];
  archived: boolean;
};

/** Pure fold — exported for unit testing without a database. */
export const evolveSlicePlacements = (
  document: SlicePlacementsDoc | null,
  event: ReadEvent<SliceEvent>,
): SlicePlacementsDoc | null => {
  switch (event.type) {
    case 'SliceDefined':
      return {
        _id: event.data.sliceId,
        modelId: event.data.modelId,
        name: event.data.name,
        placements: [],
        archived: false,
      };
    case 'EntityPlaced':
      return document
        ? {
            ...document,
            placements: [
              ...document.placements,
              {
                placedEntityId: event.data.placedEntityId,
                entityType: event.data.entityType,
                slotRole: event.data.slotRole,
                slot: event.data.slot,
              },
            ],
          }
        : null;
    case 'EntitySlotsSwapped': {
      if (!document) return null;
      const a = document.placements.find(
        (p) => p.placedEntityId === event.data.entityIdA,
      );
      const b = document.placements.find(
        (p) => p.placedEntityId === event.data.entityIdB,
      );
      if (!a || !b) return document;
      return {
        ...document,
        placements: document.placements.map((p) => {
          if (p.placedEntityId === a.placedEntityId) return { ...p, slot: b.slot };
          if (p.placedEntityId === b.placedEntityId) return { ...p, slot: a.slot };
          return p;
        }),
      };
    }
    case 'EntityRemovedFromSlice':
      return document
        ? {
            ...document,
            placements: document.placements.filter(
              (p) => p.placedEntityId !== event.data.placedEntityId,
            ),
          }
        : null;
    case 'SliceRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'SliceArchived':
      return document ? { ...document, archived: true } : null;
    default:
      return document;
  }
};

export const slicePlacementsProjection = pongoMultiStreamProjection<
  SlicePlacementsDoc,
  SliceEvent
>({
  collectionName: 'slice_placements',
  canHandle: [
    'SliceDefined',
    'EntityPlaced',
    'EntitySlotsSwapped',
    'EntityRemovedFromSlice',
    'SliceRenamed',
    'SliceArchived',
  ],
  getDocumentId: (event) => event.data.sliceId,
  evolve: evolveSlicePlacements,
});
