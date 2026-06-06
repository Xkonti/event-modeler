import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './businessFact.ts';

/**
 * Unit tests for the decider — pure GIVEN events / WHEN command / THEN events,
 * no database. Exercises the within-stream invariants the decider owns.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const defined = {
  type: 'BusinessFactDefined' as const,
  data: { factId: 'f1', name: 'BudgetYearDefined', context: 'Budgeting' },
};

describe('businessFact decider', () => {
  it('defines a fact from empty', () => {
    given([])
      .when({
        type: 'DefineBusinessFact',
        data: { factId: 'f1', name: 'BudgetYearDefined', context: 'Budgeting' },
      })
      .then([defined]);
  });

  it('rejects defining an already-defined fact', () => {
    given([defined])
      .when({
        type: 'DefineBusinessFact',
        data: { factId: 'f1', name: 'Other', context: 'Budgeting' },
      })
      .thenThrows();
  });

  it('renames an active fact', () => {
    given([defined])
      .when({ type: 'RenameBusinessFact', data: { factId: 'f1', name: 'BudgetYearOpened' } })
      .then([
        { type: 'BusinessFactRenamed', data: { factId: 'f1', name: 'BudgetYearOpened' } },
      ]);
  });

  it('rejects renaming a fact that is not defined', () => {
    given([])
      .when({ type: 'RenameBusinessFact', data: { factId: 'f1', name: 'X' } })
      .thenThrows();
  });

  it('archives an active fact', () => {
    given([defined])
      .when({ type: 'ArchiveBusinessFact', data: { factId: 'f1' } })
      .then([{ type: 'BusinessFactArchived', data: { factId: 'f1' } }]);
  });

  it('rejects archiving an already-archived fact', () => {
    given([defined, { type: 'BusinessFactArchived', data: { factId: 'f1' } }])
      .when({ type: 'ArchiveBusinessFact', data: { factId: 'f1' } })
      .thenThrows();
  });
});
