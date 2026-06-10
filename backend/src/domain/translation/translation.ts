import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { Mapping, TranslationEvent } from './events.ts';
import { isBlank } from '../../shared/fields.ts';

/**
 * Decider for a single translation stream. Within-stream invariants: define-once,
 * non-blank name, well-formed mapping (valid direction, no blank field names),
 * edit-only-while-active. Mapping update is full-replace (G3).
 *
 * `modelId` is set at Define and immutable; mutations carry only `entityId` and
 * the decider stamps `state.modelId` onto each event (F1).
 */

// --- State ---------------------------------------------------------------

export type Translation =
  | { status: 'empty' }
  | {
      status: 'active';
      modelId: string;
      entityId: string;
      name: string;
      mapping: Mapping;
    }
  | { status: 'archived'; modelId: string; entityId: string };

export const initialState = (): Translation => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineTranslation = Command<
  'DefineTranslation',
  { modelId: string; entityId: string; name: string; mapping: Mapping }
>;
export type RenameTranslation = Command<
  'RenameTranslation',
  { entityId: string; name: string }
>;
export type UpdateTranslationMapping = Command<
  'UpdateTranslationMapping',
  { entityId: string; mapping: Mapping }
>;
export type ArchiveTranslation = Command<'ArchiveTranslation', { entityId: string }>;

export type TranslationCommand =
  | DefineTranslation
  | RenameTranslation
  | UpdateTranslationMapping
  | ArchiveTranslation;

const DIRECTIONS = ['inbound', 'outbound'] as const;

const assertValidMapping = (mapping: Mapping): void => {
  if (!DIRECTIONS.includes(mapping.direction))
    throw new IllegalStateError(
      `Mapping direction must be one of: ${DIRECTIONS.join(', ')}`,
    );
  if (!Array.isArray(mapping.pairs))
    throw new IllegalStateError('Mapping pairs must be a list');
  for (const pair of mapping.pairs)
    if (isBlank(pair.externalField) || isBlank(pair.internalField))
      throw new IllegalStateError('Mapping pair fields must not be blank');
};

// --- Decide --------------------------------------------------------------

export const decide = (
  command: TranslationCommand,
  state: Translation,
): TranslationEvent => {
  switch (command.type) {
    case 'DefineTranslation': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Translation already defined');
      const { modelId, entityId, name, mapping } = command.data;
      if (isBlank(name))
        throw new IllegalStateError('Translation name must not be blank');
      assertValidMapping(mapping);
      return { type: 'TranslationDefined', data: { modelId, entityId, name, mapping } };
    }
    case 'RenameTranslation': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active translation');
      if (isBlank(command.data.name))
        throw new IllegalStateError('Translation name must not be blank');
      return {
        type: 'TranslationRenamed',
        data: { modelId: state.modelId, entityId: state.entityId, name: command.data.name },
      };
    }
    case 'UpdateTranslationMapping': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only update the mapping of an active translation');
      assertValidMapping(command.data.mapping);
      // Full-replace semantics — the new mapping is authoritative (G3).
      return {
        type: 'TranslationMappingUpdated',
        data: {
          modelId: state.modelId,
          entityId: state.entityId,
          mapping: command.data.mapping,
        },
      };
    }
    case 'ArchiveTranslation': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active translation');
      return {
        type: 'TranslationArchived',
        data: { modelId: state.modelId, entityId: state.entityId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: Translation, event: TranslationEvent): Translation => {
  switch (event.type) {
    case 'TranslationDefined': {
      const { modelId, entityId, name, mapping } = event.data;
      return { status: 'active', modelId, entityId, name, mapping };
    }
    case 'TranslationRenamed':
      return state.status === 'active' ? { ...state, name: event.data.name } : state;
    case 'TranslationMappingUpdated':
      return state.status === 'active'
        ? { ...state, mapping: event.data.mapping }
        : state;
    case 'TranslationArchived':
      return { status: 'archived', modelId: event.data.modelId, entityId: event.data.entityId };
  }
};
