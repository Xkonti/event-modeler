import { describe, expect, it } from 'bun:test';
import { normalizeName } from './naming.ts';

describe('normalizeName', () => {
  it('lowercases, trims, and collapses internal whitespace', () => {
    expect(normalizeName('  Budget  Year   Defined ')).toBe('budget year defined');
  });

  it('maps case-different spellings to the same uniqueness key', () => {
    expect(normalizeName('BudgetYearDefined')).toBe(normalizeName('budgetyeardefined'));
  });

  it('keeps distinct names distinct', () => {
    expect(normalizeName('BudgetYearDefined')).not.toBe(
      normalizeName('BudgetLineRecorded'),
    );
  });
});
