import { pongoMultiStreamProjection } from '@event-driven-io/emmett-postgresql';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { SliceEvent } from '../domain/slice/events.ts';

/**
 * READ MODEL (not a constraint) — one document per slice holding its placement
 * list, built ASYNC from the global log (src/consumers.ts). The canvas GET joins
 * this with `entity_catalog` to resolve each placed entity's name/type.
 *
 * Positions are presentation-only; this read model never gates a write (the
 * slice decider owns placement invariants from its own stream), so it is a read
 * model by definition. See notes/constraint-inline-projection-pattern.md.
 */
export type SlicePlacement = { placedEntityId: string; x: number; y: number };

export type SlicePlacementsDoc = {
  _id: string;
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
        _id: event.data.entityId,
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
                x: event.data.x,
                y: event.data.y,
              },
            ],
          }
        : null;
    case 'EntityMoved':
      return document
        ? {
            ...document,
            placements: document.placements.map((p) =>
              p.placedEntityId === event.data.placedEntityId
                ? { ...p, x: event.data.x, y: event.data.y }
                : p,
            ),
          }
        : null;
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
    'EntityMoved',
    'EntityRemovedFromSlice',
    'SliceRenamed',
    'SliceArchived',
  ],
  getDocumentId: (event) => event.data.entityId,
  evolve: evolveSlicePlacements,
});
