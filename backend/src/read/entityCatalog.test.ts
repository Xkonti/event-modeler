import { describe, expect, it } from 'bun:test';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { BusinessFactEvent } from '../domain/businessFact/events.ts';
import { evolveCatalog, type CatalogEntry } from './entityCatalog.ts';

/**
 * Unit tests for the catalog read-model fold — a pure function, no database.
 * Metadata is irrelevant to the fold, so we cast minimal event shapes.
 */
const ev = (e: BusinessFactEvent): ReadEvent<BusinessFactEvent> =>
  e as ReadEvent<BusinessFactEvent>;

describe('evolveCatalog', () => {
  it('creates a document on Defined', () => {
    const doc = evolveCatalog(
      null,
      ev({
        type: 'BusinessFactDefined',
        data: { factId: 'f1', name: 'BudgetYearDefined', context: 'Budgeting' },
      }),
    );
    expect(doc).toEqual({
      _id: 'f1',
      entityType: 'businessFact',
      name: 'BudgetYearDefined',
      context: 'Budgeting',
      archived: false,
    });
  });

  it('updates the name on Renamed', () => {
    const existing: CatalogEntry = {
      _id: 'f1',
      entityType: 'businessFact',
      name: 'Old',
      context: 'Budgeting',
      archived: false,
    };
    const doc = evolveCatalog(
      existing,
      ev({ type: 'BusinessFactRenamed', data: { factId: 'f1', name: 'New' } }),
    );
    expect(doc?.name).toBe('New');
  });

  it('marks archived on Archived', () => {
    const existing: CatalogEntry = {
      _id: 'f1',
      entityType: 'businessFact',
      name: 'BudgetYearDefined',
      context: 'Budgeting',
      archived: false,
    };
    const doc = evolveCatalog(
      existing,
      ev({ type: 'BusinessFactArchived', data: { factId: 'f1' } }),
    );
    expect(doc?.archived).toBe(true);
  });
});
