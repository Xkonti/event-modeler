import { describe, expect, it } from 'bun:test';
import type { ReadEvent } from '@event-driven-io/emmett';
import {
  evolveCatalog,
  type CatalogEntry,
  type CatalogEvent,
} from './entityCatalog.ts';

/**
 * Unit tests for the catalog read-model fold — a pure function, no database.
 * Metadata is irrelevant to the fold, so we cast minimal event shapes.
 */
const ev = (e: CatalogEvent): ReadEvent<CatalogEvent> =>
  e as ReadEvent<CatalogEvent>;

describe('evolveCatalog', () => {
  it('creates a document on Defined', () => {
    const doc = evolveCatalog(
      null,
      ev({
        type: 'BusinessFactDefined',
        data: { entityId: 'f1', name: 'BudgetYearDefined', context: 'Budgeting' },
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
      ev({ type: 'BusinessFactRenamed', data: { entityId: 'f1', name: 'New' } }),
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
      ev({ type: 'BusinessFactArchived', data: { entityId: 'f1' } }),
    );
    expect(doc?.archived).toBe(true);
  });

  it('catalogs a slice with its type on SliceDefined', () => {
    const doc = evolveCatalog(
      null,
      ev({ type: 'SliceDefined', data: { entityId: 's1', name: 'Checkout' } }),
    );
    expect(doc).toEqual({
      _id: 's1',
      entityType: 'slice',
      name: 'Checkout',
      archived: false,
    });
  });

  it('uses an empty name for an unnamed slice', () => {
    const doc = evolveCatalog(
      null,
      ev({ type: 'SliceDefined', data: { entityId: 's2' } }),
    );
    expect(doc?.name).toBe('');
  });
});
