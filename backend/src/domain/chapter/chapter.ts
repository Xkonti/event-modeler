import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { ChapterEvent } from './events.ts';
import { isBlank } from '../../shared/fields.ts';

/**
 * Decider for a single chapter stream (C1). Within-stream invariants only:
 * define-once, non-blank name, edit-only-while-active. Per-model chapter-name
 * uniqueness (its OWN namespace, separate from entity names; G-C2) is the
 * inline `chapter_names` constraint.
 *
 * `modelId` is set at Define and immutable; mutations carry only `chapterId`
 * and the decider stamps `state.modelId` onto every emitted event (F1).
 */

// --- State ---------------------------------------------------------------

export type Chapter =
  | { status: 'empty' }
  | { status: 'active'; modelId: string; chapterId: string; name: string }
  | { status: 'archived'; modelId: string; chapterId: string };

export const initialState = (): Chapter => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineChapter = Command<
  'DefineChapter',
  { modelId: string; chapterId: string; name: string }
>;
export type RenameChapter = Command<
  'RenameChapter',
  { chapterId: string; name: string }
>;
export type ArchiveChapter = Command<'ArchiveChapter', { chapterId: string }>;

export type ChapterCommand = DefineChapter | RenameChapter | ArchiveChapter;

// --- Decide --------------------------------------------------------------

export const decide = (command: ChapterCommand, state: Chapter): ChapterEvent => {
  switch (command.type) {
    case 'DefineChapter': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Chapter already defined');
      const { modelId, chapterId, name } = command.data;
      if (isBlank(name))
        throw new IllegalStateError('Chapter name must not be blank');
      return { type: 'ChapterDefined', data: { modelId, chapterId, name } };
    }
    case 'RenameChapter': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active chapter');
      if (isBlank(command.data.name))
        throw new IllegalStateError('Chapter name must not be blank');
      return {
        type: 'ChapterRenamed',
        data: { modelId: state.modelId, chapterId: state.chapterId, name: command.data.name },
      };
    }
    case 'ArchiveChapter': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active chapter');
      return {
        type: 'ChapterArchived',
        data: { modelId: state.modelId, chapterId: state.chapterId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: Chapter, event: ChapterEvent): Chapter => {
  switch (event.type) {
    case 'ChapterDefined': {
      const { modelId, chapterId, name } = event.data;
      return { status: 'active', modelId, chapterId, name };
    }
    case 'ChapterRenamed':
      return state.status === 'active' ? { ...state, name: event.data.name } : state;
    case 'ChapterArchived':
      return {
        status: 'archived',
        modelId: event.data.modelId,
        chapterId: event.data.chapterId,
      };
  }
};
