import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { ExternalBusinessFactEvent } from './events.ts';
import { hasDuplicateFieldName, isBlank, type FieldDef } from '../../shared/fields.ts';

/**
 * Decider for a single external-business-fact stream. Identical invariants to
 * the internal businessFact decider (define-once, edit-only-while-active,
 * non-blank name, no duplicate field names) — the external/internal distinction
 * is a type + rendering concern, not a rule difference. Per-model name
 * uniqueness is the inline `entity_names` constraint, not here.
 *
 * `modelId` is set at Define and immutable; mutations carry only `entityId` and
 * the decider stamps `state.modelId` onto each event (F1).
 */

// --- State ---------------------------------------------------------------

export type ExternalBusinessFact =
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

export const initialState = (): ExternalBusinessFact => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineExternalBusinessFact = Command<
  'DefineExternalBusinessFact',
  { modelId: string; entityId: string; name: string; fields: FieldDef[] }
>;
export type RenameExternalBusinessFact = Command<
  'RenameExternalBusinessFact',
  { entityId: string; name: string }
>;
export type UpdateExternalBusinessFactFields = Command<
  'UpdateExternalBusinessFactFields',
  { entityId: string; fields: FieldDef[] }
>;
export type ArchiveExternalBusinessFact = Command<
  'ArchiveExternalBusinessFact',
  { entityId: string }
>;
export type AssignExternalBusinessFactToContext = Command<
  'AssignExternalBusinessFactToContext',
  { entityId: string; contextId: string }
>;
export type ClearExternalBusinessFactContext = Command<
  'ClearExternalBusinessFactContext',
  { entityId: string }
>;

export type ExternalBusinessFactCommand =
  | DefineExternalBusinessFact
  | RenameExternalBusinessFact
  | UpdateExternalBusinessFactFields
  | AssignExternalBusinessFactToContext
  | ClearExternalBusinessFactContext
  | ArchiveExternalBusinessFact;

// --- Decide --------------------------------------------------------------

export const decide = (
  command: ExternalBusinessFactCommand,
  state: ExternalBusinessFact,
): ExternalBusinessFactEvent => {
  switch (command.type) {
    case 'DefineExternalBusinessFact': {
      if (state.status !== 'empty')
        throw new IllegalStateError('External business fact already defined');
      const { modelId, entityId, name, fields } = command.data;
      if (isBlank(name))
        throw new IllegalStateError('External business fact name must not be blank');
      if (hasDuplicateFieldName(fields))
        throw new IllegalStateError('Duplicate field name in definition');
      return {
        type: 'ExternalBusinessFactDefined',
        data: { modelId, entityId, name, fields },
      };
    }
    case 'RenameExternalBusinessFact': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active external business fact');
      if (isBlank(command.data.name))
        throw new IllegalStateError('External business fact name must not be blank');
      return {
        type: 'ExternalBusinessFactRenamed',
        data: { modelId: state.modelId, entityId: state.entityId, name: command.data.name },
      };
    }
    case 'UpdateExternalBusinessFactFields': {
      if (state.status !== 'active')
        throw new IllegalStateError(
          'Can only update fields of an active external business fact',
        );
      if (hasDuplicateFieldName(command.data.fields))
        throw new IllegalStateError('Duplicate field name in definition');
      // Full-replace semantics — the new list is the authoritative schema.
      return {
        type: 'ExternalBusinessFactFieldsUpdated',
        data: { modelId: state.modelId, entityId: state.entityId, fields: command.data.fields },
      };
    }
    case 'AssignExternalBusinessFactToContext': {
      if (state.status !== 'active')
        throw new IllegalStateError(
          'Can only assign a lane to an active external business fact',
        );
      // Last-write-wins (E1): re-assign replaces the lane, no Clear needed first.
      return {
        type: 'ExternalBusinessFactAssignedToContext',
        data: {
          modelId: state.modelId,
          entityId: state.entityId,
          contextId: command.data.contextId,
          previousContextId: state.contextId,
        },
      };
    }
    case 'ClearExternalBusinessFactContext': {
      if (state.status !== 'active')
        throw new IllegalStateError(
          'Can only clear the lane of an active external business fact',
        );
      if (state.contextId === undefined)
        throw new IllegalStateError('External business fact has no lane assigned');
      return {
        type: 'ExternalBusinessFactContextCleared',
        data: {
          modelId: state.modelId,
          entityId: state.entityId,
          contextId: state.contextId,
        },
      };
    }
    case 'ArchiveExternalBusinessFact': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active external business fact');
      return {
        type: 'ExternalBusinessFactArchived',
        data: { modelId: state.modelId, entityId: state.entityId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (
  state: ExternalBusinessFact,
  event: ExternalBusinessFactEvent,
): ExternalBusinessFact => {
  switch (event.type) {
    case 'ExternalBusinessFactDefined': {
      const { modelId, entityId, name, fields } = event.data;
      return { status: 'active', modelId, entityId, name, fields };
    }
    case 'ExternalBusinessFactRenamed':
      return state.status === 'active' ? { ...state, name: event.data.name } : state;
    case 'ExternalBusinessFactFieldsUpdated':
      return state.status === 'active' ? { ...state, fields: event.data.fields } : state;
    case 'ExternalBusinessFactAssignedToContext':
      return state.status === 'active'
        ? { ...state, contextId: event.data.contextId }
        : state;
    case 'ExternalBusinessFactContextCleared':
      return state.status === 'active' ? { ...state, contextId: undefined } : state;
    case 'ExternalBusinessFactArchived':
      return { status: 'archived', modelId: event.data.modelId, entityId: event.data.entityId };
  }
};
