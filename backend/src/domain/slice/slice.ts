import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { SliceEvent } from './events.ts';

/**
 * Decider for a single slice stream. Enforces ONLY within-stream invariants:
 * a slice can't be defined twice; an entity can be placed at most once per slice;
 * you can't move/remove an entity that isn't placed; nothing changes once archived.
 *
 * Endpoint EXISTENCE (does the placed entity exist in the catalog?) is NOT decided
 * here — a decider sees one stream only. It's left eventually-consistent (acceptable
 * single-user); see notes/event-sourcing-architecture.md.
 */

// --- State ---------------------------------------------------------------

type Placement = { placedEntityId: string; x: number; y: number };

export type Slice =
  | { status: 'empty' }
  | { status: 'active'; entityId: string; name?: string; placements: Placement[] }
  | { status: 'archived'; entityId: string };

export const initialState = (): Slice => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineSlice = Command<'DefineSlice', { entityId: string; name?: string }>;
export type PlaceEntity = Command<
  'PlaceEntity',
  { entityId: string; placedEntityId: string; x: number; y: number }
>;
export type MoveEntity = Command<
  'MoveEntity',
  { entityId: string; placedEntityId: string; x: number; y: number }
>;
export type RemoveEntityFromSlice = Command<
  'RemoveEntityFromSlice',
  { entityId: string; placedEntityId: string }
>;
export type RenameSlice = Command<'RenameSlice', { entityId: string; name: string }>;
export type ArchiveSlice = Command<'ArchiveSlice', { entityId: string }>;

export type SliceCommand =
  | DefineSlice
  | PlaceEntity
  | MoveEntity
  | RemoveEntityFromSlice
  | RenameSlice
  | ArchiveSlice;

// --- Decide --------------------------------------------------------------

export const decide = (command: SliceCommand, state: Slice): SliceEvent => {
  switch (command.type) {
    case 'DefineSlice': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Slice already defined');
      const { entityId, name } = command.data;
      return { type: 'SliceDefined', data: { entityId, name } };
    }
    case 'PlaceEntity': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only place on an active slice');
      const { entityId, placedEntityId, x, y } = command.data;
      if (state.placements.some((p) => p.placedEntityId === placedEntityId))
        throw new IllegalStateError('Entity already placed on this slice');
      return { type: 'EntityPlaced', data: { entityId, placedEntityId, x, y } };
    }
    case 'MoveEntity': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only move on an active slice');
      const { entityId, placedEntityId, x, y } = command.data;
      if (!state.placements.some((p) => p.placedEntityId === placedEntityId))
        throw new IllegalStateError('Cannot move an entity that is not placed');
      return { type: 'EntityMoved', data: { entityId, placedEntityId, x, y } };
    }
    case 'RemoveEntityFromSlice': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only remove from an active slice');
      const { entityId, placedEntityId } = command.data;
      if (!state.placements.some((p) => p.placedEntityId === placedEntityId))
        throw new IllegalStateError('Cannot remove an entity that is not placed');
      return { type: 'EntityRemovedFromSlice', data: { entityId, placedEntityId } };
    }
    case 'RenameSlice': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active slice');
      return {
        type: 'SliceRenamed',
        data: { entityId: command.data.entityId, name: command.data.name },
      };
    }
    case 'ArchiveSlice': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active slice');
      return { type: 'SliceArchived', data: { entityId: command.data.entityId } };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: Slice, event: SliceEvent): Slice => {
  switch (event.type) {
    case 'SliceDefined':
      return {
        status: 'active',
        entityId: event.data.entityId,
        name: event.data.name,
        placements: [],
      };
    case 'EntityPlaced':
      return state.status === 'active'
        ? {
            ...state,
            placements: [
              ...state.placements,
              {
                placedEntityId: event.data.placedEntityId,
                x: event.data.x,
                y: event.data.y,
              },
            ],
          }
        : state;
    case 'EntityMoved':
      return state.status === 'active'
        ? {
            ...state,
            placements: state.placements.map((p) =>
              p.placedEntityId === event.data.placedEntityId
                ? { ...p, x: event.data.x, y: event.data.y }
                : p,
            ),
          }
        : state;
    case 'EntityRemovedFromSlice':
      return state.status === 'active'
        ? {
            ...state,
            placements: state.placements.filter(
              (p) => p.placedEntityId !== event.data.placedEntityId,
            ),
          }
        : state;
    case 'SliceRenamed':
      return state.status === 'active'
        ? { ...state, name: event.data.name }
        : state;
    case 'SliceArchived':
      return { status: 'archived', entityId: event.data.entityId };
  }
};
