import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { ContextEvent } from './events.ts';
import { isBlank } from '../../shared/fields.ts';

/**
 * Decider for a single context (swimlane) stream. Within-stream invariants only:
 * define-once, non-blank name, edit-only-while-active. Per-model context-name
 * uniqueness (its OWN namespace, separate from entity names; G-C2) is the inline
 * `context_names` constraint.
 *
 * `modelId` is set at Define and immutable; mutations carry only `contextId` and
 * the decider stamps `state.modelId` onto every emitted event (F1).
 */

// --- State ---------------------------------------------------------------

export type Context =
  | { status: 'empty' }
  | { status: 'active'; modelId: string; contextId: string; name: string }
  | { status: 'archived'; modelId: string; contextId: string };

export const initialState = (): Context => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineContext = Command<
  'DefineContext',
  { modelId: string; contextId: string; name: string }
>;
export type RenameContext = Command<
  'RenameContext',
  { contextId: string; name: string }
>;
export type ArchiveContext = Command<'ArchiveContext', { contextId: string }>;

export type ContextCommand = DefineContext | RenameContext | ArchiveContext;

// --- Decide --------------------------------------------------------------

export const decide = (
  command: ContextCommand,
  state: Context,
): ContextEvent => {
  switch (command.type) {
    case 'DefineContext': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Context already defined');
      const { modelId, contextId, name } = command.data;
      if (isBlank(name))
        throw new IllegalStateError('Context name must not be blank');
      return { type: 'ContextDefined', data: { modelId, contextId, name } };
    }
    case 'RenameContext': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active context');
      if (isBlank(command.data.name))
        throw new IllegalStateError('Context name must not be blank');
      return {
        type: 'ContextRenamed',
        data: { modelId: state.modelId, contextId: state.contextId, name: command.data.name },
      };
    }
    case 'ArchiveContext': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active context');
      return {
        type: 'ContextArchived',
        data: { modelId: state.modelId, contextId: state.contextId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: Context, event: ContextEvent): Context => {
  switch (event.type) {
    case 'ContextDefined': {
      const { modelId, contextId, name } = event.data;
      return { status: 'active', modelId, contextId, name };
    }
    case 'ContextRenamed':
      return state.status === 'active' ? { ...state, name: event.data.name } : state;
    case 'ContextArchived':
      return { status: 'archived', modelId: event.data.modelId, contextId: event.data.contextId };
  }
};
