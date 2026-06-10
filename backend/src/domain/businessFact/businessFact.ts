import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { BusinessFactEvent, FieldDef } from './events.ts';
import { hasDuplicateFieldName, isBlank } from '../../shared/fields.ts';

/**
 * Decider for a single business-fact stream. Enforces ONLY within-stream
 * invariants (define-once, edit-only-while-active, non-blank name, no duplicate
 * field names). Cross-aggregate name uniqueness (per model, across types) is the
 * inline `entity_names` constraint, not here — a decider sees one stream only
 * (notes/constraint-inline-projection-pattern.md).
 *
 * `modelId` is set at Define and immutable; mutations carry only `entityId` and
 * the decider STAMPS `state.modelId` onto every emitted event (so every event
 * carries it, F1, without the API threading modelId through PUT/DELETE).
 */

// --- State ---------------------------------------------------------------

export type BusinessFact =
  | { status: 'empty' }
  | {
      status: 'active';
      modelId: string;
      entityId: string;
      name: string;
      fields: FieldDef[];
      contextId?: string;
    }
  | { status: 'archived'; modelId: string; entityId: string };

export const initialState = (): BusinessFact => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineBusinessFact = Command<
  'DefineBusinessFact',
  { modelId: string; entityId: string; name: string; fields: FieldDef[] }
>;
export type RenameBusinessFact = Command<
  'RenameBusinessFact',
  { entityId: string; name: string }
>;
export type UpdateBusinessFactFields = Command<
  'UpdateBusinessFactFields',
  { entityId: string; fields: FieldDef[] }
>;
export type ArchiveBusinessFact = Command<
  'ArchiveBusinessFact',
  { entityId: string }
>;
export type AssignBusinessFactToContext = Command<
  'AssignBusinessFactToContext',
  { entityId: string; contextId: string }
>;
export type ClearBusinessFactContext = Command<
  'ClearBusinessFactContext',
  { entityId: string }
>;

export type BusinessFactCommand =
  | DefineBusinessFact
  | RenameBusinessFact
  | UpdateBusinessFactFields
  | AssignBusinessFactToContext
  | ClearBusinessFactContext
  | ArchiveBusinessFact;

// --- Decide --------------------------------------------------------------

export const decide = (
  command: BusinessFactCommand,
  state: BusinessFact,
): BusinessFactEvent => {
  switch (command.type) {
    case 'DefineBusinessFact': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Business fact already defined');
      const { modelId, entityId, name, fields } = command.data;
      if (isBlank(name))
        throw new IllegalStateError('Business fact name must not be blank');
      if (hasDuplicateFieldName(fields))
        throw new IllegalStateError('Duplicate field name in definition');
      return { type: 'BusinessFactDefined', data: { modelId, entityId, name, fields } };
    }
    case 'RenameBusinessFact': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active business fact');
      if (isBlank(command.data.name))
        throw new IllegalStateError('Business fact name must not be blank');
      return {
        type: 'BusinessFactRenamed',
        data: { modelId: state.modelId, entityId: state.entityId, name: command.data.name },
      };
    }
    case 'UpdateBusinessFactFields': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only update fields of an active business fact');
      if (hasDuplicateFieldName(command.data.fields))
        throw new IllegalStateError('Duplicate field name in definition');
      // Full-replace semantics — the new list is the authoritative schema.
      return {
        type: 'BusinessFactFieldsUpdated',
        data: { modelId: state.modelId, entityId: state.entityId, fields: command.data.fields },
      };
    }
    case 'AssignBusinessFactToContext': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only assign a lane to an active business fact');
      // Last-write-wins (E1): re-assign replaces the lane, no Clear needed first.
      return {
        type: 'BusinessFactAssignedToContext',
        data: {
          modelId: state.modelId,
          entityId: state.entityId,
          contextId: command.data.contextId,
          previousContextId: state.contextId,
        },
      };
    }
    case 'ClearBusinessFactContext': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only clear the lane of an active business fact');
      if (state.contextId === undefined)
        throw new IllegalStateError('Business fact has no lane assigned');
      return {
        type: 'BusinessFactContextCleared',
        data: {
          modelId: state.modelId,
          entityId: state.entityId,
          contextId: state.contextId,
        },
      };
    }
    case 'ArchiveBusinessFact': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active business fact');
      return {
        type: 'BusinessFactArchived',
        data: { modelId: state.modelId, entityId: state.entityId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (
  state: BusinessFact,
  event: BusinessFactEvent,
): BusinessFact => {
  switch (event.type) {
    case 'BusinessFactDefined': {
      const { modelId, entityId, name, fields } = event.data;
      return { status: 'active', modelId, entityId, name, fields };
    }
    case 'BusinessFactRenamed':
      return state.status === 'active' ? { ...state, name: event.data.name } : state;
    case 'BusinessFactFieldsUpdated':
      return state.status === 'active' ? { ...state, fields: event.data.fields } : state;
    case 'BusinessFactAssignedToContext':
      return state.status === 'active'
        ? { ...state, contextId: event.data.contextId }
        : state;
    case 'BusinessFactContextCleared':
      return state.status === 'active' ? { ...state, contextId: undefined } : state;
    case 'BusinessFactArchived':
      return { status: 'archived', modelId: event.data.modelId, entityId: event.data.entityId };
  }
};
