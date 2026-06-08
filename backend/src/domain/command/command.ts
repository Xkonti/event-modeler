import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { CommandEvent } from './events.ts';

/**
 * Decider for a single command-entity stream. Enforces ONLY within-stream
 * invariants (can't define twice, can't edit once archived). Global name
 * uniqueness is enforced by the inline `entity_names` constraint, not here.
 *
 * NOTE: `Command` below is Emmett's command-envelope type; the domain element is
 * "command" (the thing being modeled).
 */

// --- State ---------------------------------------------------------------

export type CommandEntity =
  | { status: 'empty' }
  | { status: 'active'; entityId: string; name: string; context: string }
  | { status: 'archived'; entityId: string };

export const initialState = (): CommandEntity => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineCommand = Command<
  'DefineCommand',
  { entityId: string; name: string; context: string }
>;
export type RenameCommand = Command<
  'RenameCommand',
  { entityId: string; name: string }
>;
export type ArchiveCommand = Command<'ArchiveCommand', { entityId: string }>;

export type CommandCommand = DefineCommand | RenameCommand | ArchiveCommand;

// --- Decide --------------------------------------------------------------

export const decide = (
  command: CommandCommand,
  state: CommandEntity,
): CommandEvent => {
  switch (command.type) {
    case 'DefineCommand': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Command already defined');
      const { entityId, name, context } = command.data;
      return { type: 'CommandDefined', data: { entityId, name, context } };
    }
    case 'RenameCommand': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active command');
      return {
        type: 'CommandRenamed',
        data: { entityId: command.data.entityId, name: command.data.name },
      };
    }
    case 'ArchiveCommand': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active command');
      return {
        type: 'CommandArchived',
        data: { entityId: command.data.entityId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (
  state: CommandEntity,
  event: CommandEvent,
): CommandEntity => {
  switch (event.type) {
    case 'CommandDefined': {
      const { entityId, name, context } = event.data;
      return { status: 'active', entityId, name, context };
    }
    case 'CommandRenamed':
      return state.status === 'active'
        ? { ...state, name: event.data.name }
        : state;
    case 'CommandArchived':
      return { status: 'archived', entityId: event.data.entityId };
  }
};
