import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { CommandEvent } from './events.ts';
import { hasDuplicateFieldName, isBlank, type FieldDef } from '../../shared/fields.ts';

/**
 * Decider for a single command-entity stream. Enforces ONLY within-stream
 * invariants (define-once, edit-only-while-active, non-blank name, no duplicate
 * field names). Per-model name uniqueness is the inline `entity_names` constraint.
 *
 * `modelId` is set at Define and immutable; mutations carry only `entityId` and
 * the decider stamps `state.modelId` onto each event (F1). Commands are
 * lane-agnostic — no context (F2).
 *
 * NOTE: `Command` below is Emmett's command-envelope type; the domain element is
 * "command" (the thing being modeled).
 */

// --- State ---------------------------------------------------------------

export type CommandEntity =
  | { status: 'empty' }
  | { status: 'active'; modelId: string; entityId: string; name: string; fields: FieldDef[] }
  | { status: 'archived'; modelId: string; entityId: string };

export const initialState = (): CommandEntity => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineCommand = Command<
  'DefineCommand',
  { modelId: string; entityId: string; name: string; fields: FieldDef[] }
>;
export type RenameCommand = Command<
  'RenameCommand',
  { entityId: string; name: string }
>;
export type UpdateCommandFields = Command<
  'UpdateCommandFields',
  { entityId: string; fields: FieldDef[] }
>;
export type ArchiveCommand = Command<'ArchiveCommand', { entityId: string }>;

export type CommandCommand =
  | DefineCommand
  | RenameCommand
  | UpdateCommandFields
  | ArchiveCommand;

// --- Decide --------------------------------------------------------------

export const decide = (
  command: CommandCommand,
  state: CommandEntity,
): CommandEvent => {
  switch (command.type) {
    case 'DefineCommand': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Command already defined');
      const { modelId, entityId, name, fields } = command.data;
      if (isBlank(name)) throw new IllegalStateError('Command name must not be blank');
      if (hasDuplicateFieldName(fields))
        throw new IllegalStateError('Duplicate field name in definition');
      return { type: 'CommandDefined', data: { modelId, entityId, name, fields } };
    }
    case 'RenameCommand': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active command');
      if (isBlank(command.data.name))
        throw new IllegalStateError('Command name must not be blank');
      return {
        type: 'CommandRenamed',
        data: { modelId: state.modelId, entityId: state.entityId, name: command.data.name },
      };
    }
    case 'UpdateCommandFields': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only update fields of an active command');
      if (hasDuplicateFieldName(command.data.fields))
        throw new IllegalStateError('Duplicate field name in definition');
      // Full-replace semantics — the new list is the authoritative schema.
      return {
        type: 'CommandFieldsUpdated',
        data: { modelId: state.modelId, entityId: state.entityId, fields: command.data.fields },
      };
    }
    case 'ArchiveCommand': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active command');
      return {
        type: 'CommandArchived',
        data: { modelId: state.modelId, entityId: state.entityId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: CommandEntity, event: CommandEvent): CommandEntity => {
  switch (event.type) {
    case 'CommandDefined': {
      const { modelId, entityId, name, fields } = event.data;
      return { status: 'active', modelId, entityId, name, fields };
    }
    case 'CommandRenamed':
      return state.status === 'active' ? { ...state, name: event.data.name } : state;
    case 'CommandFieldsUpdated':
      return state.status === 'active' ? { ...state, fields: event.data.fields } : state;
    case 'CommandArchived':
      return { status: 'archived', modelId: event.data.modelId, entityId: event.data.entityId };
  }
};
