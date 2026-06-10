import type { Event } from '@event-driven-io/emmett';

/**
 * Chapter entity events (C1). One stream per chapter: `chapter-{chapterId}`.
 * A chapter is the single-level organizing band above the slice timeline
 * (es-book ch 18) — pulled forward from the full G1 hierarchy; when G1 lands,
 * chapters become level-1 groups. Like contexts, chapters are NOT catalog
 * entities: they live in their own name namespace (`chapter_names`, separate
 * from `entity_names`; G-C2) and their own read model (`chapters`).
 *
 * Slice→chapter assignment is NOT here — it lives on the SLICE stream
 * (`SliceAssignedToChapter`, mirroring the fact→context lane assignment X1).
 * Archiving a chapter leaves assigned slices pointing at it (dangling allowed;
 * render falls back to "unchaptered" — same lean as archived lanes).
 */
export type ChapterDefined = Event<
  'ChapterDefined',
  { modelId: string; chapterId: string; name: string }
>;

export type ChapterRenamed = Event<
  'ChapterRenamed',
  { modelId: string; chapterId: string; name: string }
>;

export type ChapterArchived = Event<
  'ChapterArchived',
  { modelId: string; chapterId: string }
>;

export type ChapterEvent = ChapterDefined | ChapterRenamed | ChapterArchived;
