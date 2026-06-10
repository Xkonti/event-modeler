import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { SliceEvent } from './events.ts';
import type { EntityType } from '../../shared/streams.ts';
import { isSingleCardinality, slotRoleFor } from '../../shared/slotRoles.ts';
import { isBlank } from '../../shared/fields.ts';

/**
 * Decider for a single slice stream (F3 snap-slot model). Within-stream
 * invariants: define-once; an entity placed at most once per slice; at most ONE
 * command / automation / translation per slice (single-cardinality bands); slots
 * swap only within the same band and only between slotted placements; nothing
 * changes once archived.
 *
 * The decider computes the `slot` (append to the bottom of the band) and the
 * `slotRole` from the entityType the API resolved via the catalog. Endpoint
 * EXISTENCE (does the placed entity exist?) is NOT decided here — a decider sees
 * one stream only; it's the API edge's catalog pre-check (eventually
 * consistent, acceptable single-user). `modelId` is set at Define and stamped
 * from state onto every mutation (F1).
 */

// --- State ---------------------------------------------------------------

type Placement = {
  placedEntityId: string;
  entityType: EntityType;
  slotRole: string;
  slot?: number;
};

export type Slice =
  | { status: 'empty' }
  | {
      status: 'active';
      modelId: string;
      sliceId: string;
      name?: string;
      placements: Placement[];
    }
  | { status: 'archived'; modelId: string; sliceId: string };

export const initialState = (): Slice => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineSlice = Command<
  'DefineSlice',
  { modelId: string; sliceId: string; name?: string }
>;
export type PlaceEntity = Command<
  'PlaceEntity',
  { sliceId: string; placedEntityId: string; entityType: EntityType }
>;
export type SwapEntitySlots = Command<
  'SwapEntitySlots',
  { sliceId: string; entityIdA: string; entityIdB: string }
>;
export type RemoveEntityFromSlice = Command<
  'RemoveEntityFromSlice',
  { sliceId: string; placedEntityId: string }
>;
export type RenameSlice = Command<'RenameSlice', { sliceId: string; name: string }>;
export type ArchiveSlice = Command<'ArchiveSlice', { sliceId: string }>;

export type SliceCommand =
  | DefineSlice
  | PlaceEntity
  | SwapEntitySlots
  | RemoveEntityFromSlice
  | RenameSlice
  | ArchiveSlice;

// --- Decide --------------------------------------------------------------

export const decide = (command: SliceCommand, state: Slice): SliceEvent => {
  switch (command.type) {
    case 'DefineSlice': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Slice already defined');
      const { modelId, sliceId, name } = command.data;
      return { type: 'SliceDefined', data: { modelId, sliceId, name } };
    }
    case 'PlaceEntity': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only place on an active slice');
      const { placedEntityId, entityType } = command.data;
      const slotRole = slotRoleFor(entityType);
      if (!slotRole)
        throw new IllegalStateError(`Entity type '${entityType}' is not placeable`);
      if (state.placements.some((p) => p.placedEntityId === placedEntityId))
        throw new IllegalStateError('Entity already placed on this slice');
      if (
        isSingleCardinality(entityType) &&
        state.placements.some((p) => p.entityType === entityType)
      )
        throw new IllegalStateError(
          `A slice holds at most one ${entityType}`,
        );
      // Multi-cardinality bands append to the bottom; singles carry no slot.
      const slot = isSingleCardinality(entityType)
        ? undefined
        : state.placements
            .filter((p) => p.slotRole === slotRole && p.slot !== undefined)
            .reduce((max, p) => Math.max(max, p.slot ?? -1), -1) + 1;
      return {
        type: 'EntityPlaced',
        data: {
          modelId: state.modelId,
          sliceId: state.sliceId,
          placedEntityId,
          entityType,
          slotRole,
          slot,
        },
      };
    }
    case 'SwapEntitySlots': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only swap on an active slice');
      const { entityIdA, entityIdB } = command.data;
      const a = state.placements.find((p) => p.placedEntityId === entityIdA);
      const b = state.placements.find((p) => p.placedEntityId === entityIdB);
      if (!a || !b)
        throw new IllegalStateError('Cannot swap entities that are not placed');
      if (a.slotRole !== b.slotRole)
        throw new IllegalStateError('Cannot swap slots across bands');
      if (a.slot === undefined || b.slot === undefined)
        throw new IllegalStateError('Cannot swap unslotted placements');
      return {
        type: 'EntitySlotsSwapped',
        data: { modelId: state.modelId, sliceId: state.sliceId, entityIdA, entityIdB },
      };
    }
    case 'RemoveEntityFromSlice': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only remove from an active slice');
      const { placedEntityId } = command.data;
      if (!state.placements.some((p) => p.placedEntityId === placedEntityId))
        throw new IllegalStateError('Cannot remove an entity that is not placed');
      return {
        type: 'EntityRemovedFromSlice',
        data: { modelId: state.modelId, sliceId: state.sliceId, placedEntityId },
      };
    }
    case 'RenameSlice': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active slice');
      if (isBlank(command.data.name))
        throw new IllegalStateError('Slice name must not be blank');
      return {
        type: 'SliceRenamed',
        data: { modelId: state.modelId, sliceId: state.sliceId, name: command.data.name },
      };
    }
    case 'ArchiveSlice': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active slice');
      return {
        type: 'SliceArchived',
        data: { modelId: state.modelId, sliceId: state.sliceId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: Slice, event: SliceEvent): Slice => {
  switch (event.type) {
    case 'SliceDefined':
      return {
        status: 'active',
        modelId: event.data.modelId,
        sliceId: event.data.sliceId,
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
                entityType: event.data.entityType,
                slotRole: event.data.slotRole,
                slot: event.data.slot,
              },
            ],
          }
        : state;
    case 'EntitySlotsSwapped': {
      if (state.status !== 'active') return state;
      const a = state.placements.find(
        (p) => p.placedEntityId === event.data.entityIdA,
      );
      const b = state.placements.find(
        (p) => p.placedEntityId === event.data.entityIdB,
      );
      if (!a || !b) return state;
      return {
        ...state,
        placements: state.placements.map((p) => {
          if (p.placedEntityId === a.placedEntityId) return { ...p, slot: b.slot };
          if (p.placedEntityId === b.placedEntityId) return { ...p, slot: a.slot };
          return p;
        }),
      };
    }
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
      return { status: 'archived', modelId: event.data.modelId, sliceId: event.data.sliceId };
  }
};
