import { pongoMultiStreamProjection } from '@event-driven-io/emmett-postgresql';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { ChapterEvent } from '../domain/chapter/events.ts';

/**
 * READ MODEL — the per-model chapter list (C1, the single-level organizing band
 * above the slice timeline). One Pongo document per chapter, built ASYNC from
 * the global log (src/consumers.ts). Band order = creation order in v1
 * (`definedAtPosition`), same convention as slice tiling.
 *
 * The slice→chapter pointer is NOT stored here: a re-assign (last-write-wins,
 * mirroring lane re-assign E1) touches TWO chapters, but a projection folds one
 * document per event — so membership lives on the slice (catalog `chapterId` +
 * `slice_placements.chapterId`) and is joined at read time, exactly like the
 * contexts/factCount pattern.
 */
export type ChapterDoc = {
  _id: string;
  modelId: string;
  name: string;
  archived: boolean;
  /** Global log position of ChapterDefined — creation order for the band. */
  definedAtPosition?: number;
};

const definedAt = (event: ReadEvent<ChapterEvent>): number | undefined => {
  const gp = (event.metadata as { globalPosition?: bigint | number } | undefined)
    ?.globalPosition;
  return gp === undefined ? undefined : Number(gp);
};

/** Pure fold — exported for unit testing without a database. */
export const evolveChapters = (
  document: ChapterDoc | null,
  event: ReadEvent<ChapterEvent>,
): ChapterDoc | null => {
  switch (event.type) {
    case 'ChapterDefined':
      return {
        _id: event.data.chapterId,
        modelId: event.data.modelId,
        name: event.data.name,
        archived: false,
        definedAtPosition: definedAt(event),
      };
    case 'ChapterRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'ChapterArchived':
      return document ? { ...document, archived: true } : null;
  }
};

export const chaptersProjection = pongoMultiStreamProjection<ChapterDoc, ChapterEvent>({
  collectionName: 'chapters',
  canHandle: ['ChapterDefined', 'ChapterRenamed', 'ChapterArchived'],
  getDocumentId: (event) => event.data.chapterId,
  evolve: evolveChapters,
});
