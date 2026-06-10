import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { WireframeEvent } from './events.ts';
import { isBlank } from '../../shared/fields.ts';

/**
 * Decider for a single wireframe stream. Enforces ONLY within-stream invariants
 * (define-once, edit-only-while-active, non-blank name). `content` carries no
 * structural rules — any string (including empty: a named, not-yet-sketched
 * wireframe) is valid. Per-model name uniqueness is the inline `entity_names`
 * constraint, not here.
 *
 * `modelId` is set at Define and immutable; mutations carry only `entityId` and
 * the decider stamps `state.modelId` onto each event (F1).
 */

// --- State ---------------------------------------------------------------

export type Wireframe =
  | { status: 'empty' }
  | { status: 'active'; modelId: string; entityId: string; name: string; content: string }
  | { status: 'archived'; modelId: string; entityId: string };

export const initialState = (): Wireframe => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineWireframe = Command<
  'DefineWireframe',
  { modelId: string; entityId: string; name: string; content: string }
>;
export type RenameWireframe = Command<
  'RenameWireframe',
  { entityId: string; name: string }
>;
export type UpdateWireframeContent = Command<
  'UpdateWireframeContent',
  { entityId: string; content: string }
>;
export type ArchiveWireframe = Command<'ArchiveWireframe', { entityId: string }>;

export type WireframeCommand =
  | DefineWireframe
  | RenameWireframe
  | UpdateWireframeContent
  | ArchiveWireframe;

// --- Decide --------------------------------------------------------------

export const decide = (command: WireframeCommand, state: Wireframe): WireframeEvent => {
  switch (command.type) {
    case 'DefineWireframe': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Wireframe already defined');
      const { modelId, entityId, name, content } = command.data;
      if (isBlank(name)) throw new IllegalStateError('Wireframe name must not be blank');
      return { type: 'WireframeDefined', data: { modelId, entityId, name, content } };
    }
    case 'RenameWireframe': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active wireframe');
      if (isBlank(command.data.name))
        throw new IllegalStateError('Wireframe name must not be blank');
      return {
        type: 'WireframeRenamed',
        data: { modelId: state.modelId, entityId: state.entityId, name: command.data.name },
      };
    }
    case 'UpdateWireframeContent': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only update content of an active wireframe');
      // Full-replace semantics — the new content is authoritative.
      return {
        type: 'WireframeContentUpdated',
        data: { modelId: state.modelId, entityId: state.entityId, content: command.data.content },
      };
    }
    case 'ArchiveWireframe': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active wireframe');
      return {
        type: 'WireframeArchived',
        data: { modelId: state.modelId, entityId: state.entityId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: Wireframe, event: WireframeEvent): Wireframe => {
  switch (event.type) {
    case 'WireframeDefined': {
      const { modelId, entityId, name, content } = event.data;
      return { status: 'active', modelId, entityId, name, content };
    }
    case 'WireframeRenamed':
      return state.status === 'active' ? { ...state, name: event.data.name } : state;
    case 'WireframeContentUpdated':
      return state.status === 'active' ? { ...state, content: event.data.content } : state;
    case 'WireframeArchived':
      return { status: 'archived', modelId: event.data.modelId, entityId: event.data.entityId };
  }
};
