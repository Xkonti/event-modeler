import { describe, expect, it } from 'bun:test';
import type { ReadEvent } from '@event-driven-io/emmett';
import { evolveChapters } from './chapters.ts';
import type { ChapterEvent } from '../domain/chapter/events.ts';

/**
 * Unit tests for the chapters read-model fold (C1) — pure, no database. The
 * slice→chapter pointer is NOT here (it lives on the slice docs); this is just
 * the per-model chapter list in creation order.
 */
const M = 'm-budget';

const ev = (e: ChapterEvent, globalPosition?: bigint): ReadEvent<ChapterEvent> =>
  ({
    ...e,
    metadata: globalPosition !== undefined ? { globalPosition } : undefined,
  }) as unknown as ReadEvent<ChapterEvent>;

describe('chapters read model', () => {
  it('creates a chapter document with creation order on Defined', () => {
    const doc = evolveChapters(
      null,
      ev({ type: 'ChapterDefined', data: { modelId: M, chapterId: 'ch1', name: 'Setup' } }, 7n),
    );
    expect(doc).toEqual({
      _id: 'ch1',
      modelId: M,
      name: 'Setup',
      archived: false,
      definedAtPosition: 7,
    });
  });

  it('renames and archives', () => {
    const created = evolveChapters(
      null,
      ev({ type: 'ChapterDefined', data: { modelId: M, chapterId: 'ch1', name: 'Setup' } }),
    );
    const renamed = evolveChapters(
      created,
      ev({ type: 'ChapterRenamed', data: { modelId: M, chapterId: 'ch1', name: 'Catalog' } }),
    );
    expect(renamed?.name).toBe('Catalog');
    const gone = evolveChapters(
      renamed,
      ev({ type: 'ChapterArchived', data: { modelId: M, chapterId: 'ch1' } }),
    );
    expect(gone?.archived).toBe(true);
  });
});
