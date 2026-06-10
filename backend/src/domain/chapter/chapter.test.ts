import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './chapter.ts';

/**
 * Unit tests for the chapter decider (C1) — within-stream invariants only
 * (define-once, non-blank name, edit-only-while-active). Per-model chapter-name
 * uniqueness is the inline `chapter_names` constraint (integration suite).
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const M = 'm-budget';
const defined = {
  type: 'ChapterDefined' as const,
  data: { modelId: M, chapterId: 'ch1', name: 'Setup' },
};
const archived = {
  type: 'ChapterArchived' as const,
  data: { modelId: M, chapterId: 'ch1' },
};

describe('chapter decider', () => {
  it('defines a chapter from empty', () => {
    given([])
      .when({ type: 'DefineChapter', data: defined.data })
      .then([defined]);
  });

  it('rejects a blank name on define (G-C1)', () => {
    given([])
      .when({ type: 'DefineChapter', data: { modelId: M, chapterId: 'ch1', name: '  ' } })
      .thenThrows();
  });

  it('rejects defining an already-defined chapter', () => {
    given([defined])
      .when({ type: 'DefineChapter', data: { modelId: M, chapterId: 'ch1', name: 'Other' } })
      .thenThrows();
  });

  it('renames an active chapter (modelId stamped from state)', () => {
    given([defined])
      .when({ type: 'RenameChapter', data: { chapterId: 'ch1', name: 'Catalog' } })
      .then([
        {
          type: 'ChapterRenamed',
          data: { modelId: M, chapterId: 'ch1', name: 'Catalog' },
        },
      ]);
  });

  it('rejects renaming an archived chapter (G-C5)', () => {
    given([defined, archived])
      .when({ type: 'RenameChapter', data: { chapterId: 'ch1', name: 'X' } })
      .thenThrows();
  });

  it('archives an active chapter', () => {
    given([defined])
      .when({ type: 'ArchiveChapter', data: { chapterId: 'ch1' } })
      .then([archived]);
  });

  it('rejects archiving an already-archived chapter (G-C6)', () => {
    given([defined, archived])
      .when({ type: 'ArchiveChapter', data: { chapterId: 'ch1' } })
      .thenThrows();
  });
});
