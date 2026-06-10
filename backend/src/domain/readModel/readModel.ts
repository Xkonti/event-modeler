import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { ReadModelEvent } from './events.ts';
import { hasDuplicateFieldName, isBlank, type FieldDef } from '../../shared/fields.ts';

/**
 * Decider for a single read-model-entity stream. Enforces ONLY within-stream
 * invariants (define-once, edit-only-while-active, non-blank name, no duplicate
 * field names). Per-model name uniqueness is the inline `entity_names`
 * constraint, not here.
 *
 * `modelId` is set at Define and immutable; mutations carry only `entityId` and
 * the decider stamps `state.modelId` onto each event (F1).
 */

// --- State ---------------------------------------------------------------

export type ReadModelEntity =
  | { status: 'empty' }
  | { status: 'active'; modelId: string; entityId: string; name: string; fields: FieldDef[] }
  | { status: 'archived'; modelId: string; entityId: string };

export const initialState = (): ReadModelEntity => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineReadModel = Command<
  'DefineReadModel',
  { modelId: string; entityId: string; name: string; fields: FieldDef[] }
>;
export type RenameReadModel = Command<
  'RenameReadModel',
  { entityId: string; name: string }
>;
export type UpdateReadModelFields = Command<
  'UpdateReadModelFields',
  { entityId: string; fields: FieldDef[] }
>;
export type ArchiveReadModel = Command<'ArchiveReadModel', { entityId: string }>;

export type ReadModelCommand =
  | DefineReadModel
  | RenameReadModel
  | UpdateReadModelFields
  | ArchiveReadModel;

// --- Decide --------------------------------------------------------------

export const decide = (
  command: ReadModelCommand,
  state: ReadModelEntity,
): ReadModelEvent => {
  switch (command.type) {
    case 'DefineReadModel': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Read model already defined');
      const { modelId, entityId, name, fields } = command.data;
      if (isBlank(name)) throw new IllegalStateError('Read model name must not be blank');
      if (hasDuplicateFieldName(fields))
        throw new IllegalStateError('Duplicate field name in definition');
      return { type: 'ReadModelDefined', data: { modelId, entityId, name, fields } };
    }
    case 'RenameReadModel': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active read model');
      if (isBlank(command.data.name))
        throw new IllegalStateError('Read model name must not be blank');
      return {
        type: 'ReadModelRenamed',
        data: { modelId: state.modelId, entityId: state.entityId, name: command.data.name },
      };
    }
    case 'UpdateReadModelFields': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only update fields of an active read model');
      if (hasDuplicateFieldName(command.data.fields))
        throw new IllegalStateError('Duplicate field name in definition');
      // Full-replace semantics — the new list is the authoritative schema.
      return {
        type: 'ReadModelFieldsUpdated',
        data: { modelId: state.modelId, entityId: state.entityId, fields: command.data.fields },
      };
    }
    case 'ArchiveReadModel': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active read model');
      return {
        type: 'ReadModelArchived',
        data: { modelId: state.modelId, entityId: state.entityId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (
  state: ReadModelEntity,
  event: ReadModelEvent,
): ReadModelEntity => {
  switch (event.type) {
    case 'ReadModelDefined': {
      const { modelId, entityId, name, fields } = event.data;
      return { status: 'active', modelId, entityId, name, fields };
    }
    case 'ReadModelRenamed':
      return state.status === 'active' ? { ...state, name: event.data.name } : state;
    case 'ReadModelFieldsUpdated':
      return state.status === 'active' ? { ...state, fields: event.data.fields } : state;
    case 'ReadModelArchived':
      return { status: 'archived', modelId: event.data.modelId, entityId: event.data.entityId };
  }
};
