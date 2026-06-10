import { describe, expect, it } from 'bun:test';
import type { ReadEvent } from '@event-driven-io/emmett';
import { evolveContexts, type ContextDoc } from './contexts.ts';
import type { ContextEvent } from '../domain/context/events.ts';

/** Unit tests for the contexts read-model fold — pure, no database. */
const ev = (e: ContextEvent): ReadEvent<ContextEvent> => e as ReadEvent<ContextEvent>;

const M = 'm-budget';

describe('evolveContexts', () => {
  it('creates a context document on Defined', () => {
    const doc = evolveContexts(
      null,
      ev({ type: 'ContextDefined', data: { modelId: M, contextId: 'c1', name: 'Billing' } }),
    );
    expect(doc).toEqual({ _id: 'c1', modelId: M, name: 'Billing', archived: false });
  });

  it('updates the name on Renamed', () => {
    const existing: ContextDoc = { _id: 'c1', modelId: M, name: 'Old', archived: false };
    const doc = evolveContexts(
      existing,
      ev({ type: 'ContextRenamed', data: { modelId: M, contextId: 'c1', name: 'New' } }),
    );
    expect(doc?.name).toBe('New');
  });

  it('marks the document archived on Archived (kept, not deleted)', () => {
    const existing: ContextDoc = { _id: 'c1', modelId: M, name: 'Billing', archived: false };
    const doc = evolveContexts(
      existing,
      ev({ type: 'ContextArchived', data: { modelId: M, contextId: 'c1' } }),
    );
    expect(doc?.archived).toBe(true);
  });
});
