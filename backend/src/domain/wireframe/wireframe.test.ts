import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './wireframe.ts';

/**
 * Unit tests for the wireframe decider — within-stream invariants only
 * (em-scenarios Flow 1). Payload is `content`, not `fields`; empty content is
 * valid (a named, not-yet-sketched wireframe).
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const M = 'm-budget';
const defined = {
  type: 'WireframeDefined' as const,
  data: { modelId: M, entityId: 'w1', name: 'Budget Entry Form', content: '[form sketch]' },
};
const archived = {
  type: 'WireframeArchived' as const,
  data: { modelId: M, entityId: 'w1' },
};

describe('wireframe decider', () => {
  it('defines a wireframe from empty', () => {
    given([])
      .when({ type: 'DefineWireframe', data: defined.data })
      .then([defined]);
  });

  it('allows empty content (named but not yet sketched)', () => {
    given([])
      .when({
        type: 'DefineWireframe',
        data: { modelId: M, entityId: 'w1', name: 'X', content: '' },
      })
      .then([
        {
          type: 'WireframeDefined',
          data: { modelId: M, entityId: 'w1', name: 'X', content: '' },
        },
      ]);
  });

  it('rejects a blank name on define (G-C1)', () => {
    given([])
      .when({
        type: 'DefineWireframe',
        data: { modelId: M, entityId: 'w1', name: '  ', content: '' },
      })
      .thenThrows();
  });

  it('rejects defining an already-defined wireframe', () => {
    given([defined])
      .when({
        type: 'DefineWireframe',
        data: { modelId: M, entityId: 'w1', name: 'Other', content: '' },
      })
      .thenThrows();
  });

  it('renames an active wireframe (modelId stamped from state)', () => {
    given([defined])
      .when({ type: 'RenameWireframe', data: { entityId: 'w1', name: 'Entry Form' } })
      .then([
        {
          type: 'WireframeRenamed',
          data: { modelId: M, entityId: 'w1', name: 'Entry Form' },
        },
      ]);
  });

  it('updates content with full-replace semantics', () => {
    given([defined])
      .when({ type: 'UpdateWireframeContent', data: { entityId: 'w1', content: 'v2' } })
      .then([
        {
          type: 'WireframeContentUpdated',
          data: { modelId: M, entityId: 'w1', content: 'v2' },
        },
      ]);
  });

  it('rejects updating content of an archived wireframe (G-C5)', () => {
    given([defined, archived])
      .when({ type: 'UpdateWireframeContent', data: { entityId: 'w1', content: 'x' } })
      .thenThrows();
  });

  it('archives an active wireframe', () => {
    given([defined])
      .when({ type: 'ArchiveWireframe', data: { entityId: 'w1' } })
      .then([archived]);
  });

  it('rejects archiving an already-archived wireframe (G-C6)', () => {
    given([defined, archived])
      .when({ type: 'ArchiveWireframe', data: { entityId: 'w1' } })
      .thenThrows();
  });
});
