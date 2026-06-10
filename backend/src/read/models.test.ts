import { describe, expect, it } from 'bun:test';
import type { ReadEvent } from '@event-driven-io/emmett';
import { evolveModels, type ModelDoc, type ModelsEvent } from './models.ts';

/** Pure fold test — the S1 sliceCount derivation on top of the F0 lifecycle. */
const ev = (e: ModelsEvent): ReadEvent<ModelsEvent> => e as ReadEvent<ModelsEvent>;

const M = 'm-budget';

describe('evolveModels', () => {
  it('counts SliceDefined up and SliceArchived down (S1)', () => {
    let doc: ModelDoc | null = evolveModels(
      null,
      ev({ type: 'ModelCreated', data: { modelId: M, name: 'Budget' } }),
    );
    expect(doc?.sliceCount).toBe(0);
    doc = evolveModels(doc, ev({ type: 'SliceDefined', data: { modelId: M, sliceId: 's1' } }));
    doc = evolveModels(doc, ev({ type: 'SliceDefined', data: { modelId: M, sliceId: 's2' } }));
    expect(doc?.sliceCount).toBe(2);
    doc = evolveModels(doc, ev({ type: 'SliceArchived', data: { modelId: M, sliceId: 's1' } }));
    expect(doc?.sliceCount).toBe(1);
  });

  it('ignores slice events for an unknown model (no document)', () => {
    expect(
      evolveModels(null, ev({ type: 'SliceDefined', data: { modelId: M, sliceId: 's1' } })),
    ).toBeNull();
  });
});
