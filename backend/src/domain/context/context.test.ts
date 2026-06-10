import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './context.ts';

/**
 * Unit tests for the context (swimlane) decider — within-stream invariants only
 * (define-once, non-blank name, edit-only-while-active). Per-model lane-name
 * uniqueness (contexts' own namespace) is the inline `context_names` constraint —
 * integration-tested, not here.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const M = 'm-budget';
const defined = {
  type: 'ContextDefined' as const,
  data: { modelId: M, contextId: 'c1', name: 'Billing' },
};
const archived = {
  type: 'ContextArchived' as const,
  data: { modelId: M, contextId: 'c1' },
};

describe('context decider', () => {
  it('defines a context from empty', () => {
    given([])
      .when({ type: 'DefineContext', data: defined.data })
      .then([defined]);
  });

  it('rejects a blank name on define (G-C1)', () => {
    given([])
      .when({
        type: 'DefineContext',
        data: { modelId: M, contextId: 'c1', name: '  ' },
      })
      .thenThrows();
  });

  it('rejects defining an already-defined context', () => {
    given([defined])
      .when({
        type: 'DefineContext',
        data: { modelId: M, contextId: 'c1', name: 'Other' },
      })
      .thenThrows();
  });

  it('renames an active context (modelId stamped from state)', () => {
    given([defined])
      .when({ type: 'RenameContext', data: { contextId: 'c1', name: 'Payments' } })
      .then([
        {
          type: 'ContextRenamed',
          data: { modelId: M, contextId: 'c1', name: 'Payments' },
        },
      ]);
  });

  it('rejects renaming a context that is not defined (G-C4)', () => {
    given([])
      .when({ type: 'RenameContext', data: { contextId: 'c1', name: 'X' } })
      .thenThrows();
  });

  it('archives an active context', () => {
    given([defined])
      .when({ type: 'ArchiveContext', data: { contextId: 'c1' } })
      .then([archived]);
  });

  it('rejects archiving an already-archived context (G-C6)', () => {
    given([defined, archived])
      .when({ type: 'ArchiveContext', data: { contextId: 'c1' } })
      .thenThrows();
  });

  it('rejects renaming an archived context (G-C5)', () => {
    given([defined, archived])
      .when({ type: 'RenameContext', data: { contextId: 'c1', name: 'X' } })
      .thenThrows();
  });
});
