import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './model.ts';

/**
 * Unit tests for the model decider — pure GIVEN events / WHEN command / THEN
 * events, no database. Exercises the within-stream invariants (create-once,
 * non-blank name, archive terminal). These are the Flow 0 GWT scenarios
 * (spec/em-scenarios-results.md) for the state-change slices.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const created = {
  type: 'ModelCreated' as const,
  data: { modelId: 'm1', name: 'Budgeting' },
};
const archived = {
  type: 'ModelArchived' as const,
  data: { modelId: 'm1' },
};

describe('model decider', () => {
  it('creates a model from empty', () => {
    given([])
      .when({ type: 'CreateModel', data: { modelId: 'm1', name: 'Budgeting' } })
      .then([created]);
  });

  it('rejects a blank name on create (G-C1)', () => {
    given([])
      .when({ type: 'CreateModel', data: { modelId: 'm1', name: '   ' } })
      .thenThrows();
  });

  it('rejects creating an already-created model', () => {
    given([created])
      .when({ type: 'CreateModel', data: { modelId: 'm1', name: 'Other' } })
      .thenThrows();
  });

  it('renames an active model', () => {
    given([created])
      .when({ type: 'RenameModel', data: { modelId: 'm1', name: 'Household Budget' } })
      .then([
        { type: 'ModelRenamed', data: { modelId: 'm1', name: 'Household Budget' } },
      ]);
  });

  it('allows a no-op rename (G-C7)', () => {
    given([created])
      .when({ type: 'RenameModel', data: { modelId: 'm1', name: 'Budgeting' } })
      .then([{ type: 'ModelRenamed', data: { modelId: 'm1', name: 'Budgeting' } }]);
  });

  it('rejects a blank name on rename (G-C1)', () => {
    given([created])
      .when({ type: 'RenameModel', data: { modelId: 'm1', name: '' } })
      .thenThrows();
  });

  it('rejects renaming a model that was never created (G-C4)', () => {
    given([])
      .when({ type: 'RenameModel', data: { modelId: 'm1', name: 'X' } })
      .thenThrows();
  });

  it('rejects renaming an archived model (G-C5)', () => {
    given([created, archived])
      .when({ type: 'RenameModel', data: { modelId: 'm1', name: 'X' } })
      .thenThrows();
  });

  it('archives an active model', () => {
    given([created])
      .when({ type: 'ArchiveModel', data: { modelId: 'm1' } })
      .then([archived]);
  });

  it('rejects archiving an already-archived model (G-C6)', () => {
    given([created, archived])
      .when({ type: 'ArchiveModel', data: { modelId: 'm1' } })
      .thenThrows();
  });
});
