import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { ModelEvent } from './events.ts';

/**
 * Decider for a single model stream. Enforces ONLY within-stream invariants (a
 * model can't be created twice, can't be edited once archived, name non-blank).
 *
 * Model NAMES are NOT unique in v1 (two "Budgeting" models are allowed —
 * em-scenarios open Q1), so there is no cross-aggregate constraint here. When
 * that changes it becomes an inline constraint projection, never decider logic
 * (a decider sees one stream only; notes/constraint-inline-projection-pattern.md).
 */

// --- State ---------------------------------------------------------------

export type Model =
  | { status: 'empty' }
  | { status: 'active'; modelId: string; name: string }
  | { status: 'archived'; modelId: string };

export const initialState = (): Model => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type CreateModel = Command<'CreateModel', { modelId: string; name: string }>;
export type RenameModel = Command<'RenameModel', { modelId: string; name: string }>;
export type ArchiveModel = Command<'ArchiveModel', { modelId: string }>;

export type ModelCommand = CreateModel | RenameModel | ArchiveModel;

// --- Decide --------------------------------------------------------------

const isBlank = (name: string): boolean => name.trim().length === 0;

export const decide = (command: ModelCommand, state: Model): ModelEvent => {
  switch (command.type) {
    case 'CreateModel': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Model already created');
      const { modelId, name } = command.data;
      if (isBlank(name)) throw new IllegalStateError('Model name must not be blank');
      return { type: 'ModelCreated', data: { modelId, name } };
    }
    case 'RenameModel': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active model');
      const { modelId, name } = command.data;
      if (isBlank(name)) throw new IllegalStateError('Model name must not be blank');
      // G-C7: a no-op rename (same value) still emits — keeps the decider simple.
      return { type: 'ModelRenamed', data: { modelId, name } };
    }
    case 'ArchiveModel': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active model');
      return { type: 'ModelArchived', data: { modelId: command.data.modelId } };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: Model, event: ModelEvent): Model => {
  switch (event.type) {
    case 'ModelCreated': {
      const { modelId, name } = event.data;
      return { status: 'active', modelId, name };
    }
    case 'ModelRenamed':
      return state.status === 'active' ? { ...state, name: event.data.name } : state;
    case 'ModelArchived':
      return { status: 'archived', modelId: event.data.modelId };
  }
};
