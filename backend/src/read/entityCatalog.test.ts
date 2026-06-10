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

const M = 'm-budget';

describe('evolveCatalog', () => {
  it('creates a businessFact document (with modelId + definition) on Defined', () => {
    const doc = evolveCatalog(
      null,
      ev({
        type: 'BusinessFactDefined',
        data: {
          modelId: M,
          entityId: 'f1',
          name: 'BudgetYearDefined',
          fields: [{ fieldName: 'year', fieldType: 'number' }],
        },
      }),
    );
    expect(doc).toEqual({
      _id: 'f1',
      modelId: M,
      entityType: 'businessFact',
      name: 'BudgetYearDefined',
      definition: { fields: [{ fieldName: 'year', fieldType: 'number' }] },
      archived: false,
    });
  });

  it('updates the name on Renamed', () => {
    const existing: CatalogEntry = {
      _id: 'f1',
      modelId: M,
      entityType: 'businessFact',
      name: 'Old',
      definition: { fields: [] },
      archived: false,
    };
    const doc = evolveCatalog(
      existing,
      ev({ type: 'BusinessFactRenamed', data: { modelId: M, entityId: 'f1', name: 'New' } }),
    );
    expect(doc?.name).toBe('New');
  });

  it('sets and clears contextId on lane assignment events (X1)', () => {
    const existing: CatalogEntry = {
      _id: 'f1',
      modelId: M,
      entityType: 'businessFact',
      name: 'F',
      definition: { fields: [] },
      archived: false,
    };
    const assigned = evolveCatalog(
      existing,
      ev({
        type: 'BusinessFactAssignedToContext',
        data: { modelId: M, entityId: 'f1', contextId: 'c1' },
      }),
    );
    expect(assigned?.contextId).toBe('c1');
    const cleared = evolveCatalog(
      assigned,
      ev({
        type: 'BusinessFactContextCleared',
        data: { modelId: M, entityId: 'f1', contextId: 'c1' },
      }),
    );
    expect(cleared?.contextId).toBeUndefined();
  });

  it('replaces the definition on FieldsUpdated (latest wins)', () => {
    const existing: CatalogEntry = {
      _id: 'f1',
      modelId: M,
      entityType: 'businessFact',
      name: 'F',
      definition: { fields: [{ fieldName: 'amount', fieldType: 'money' }] },
      archived: false,
    };
    const doc = evolveCatalog(
      existing,
      ev({
        type: 'BusinessFactFieldsUpdated',
        data: {
          modelId: M,
          entityId: 'f1',
          fields: [
            { fieldName: 'amount', fieldType: 'money' },
            { fieldName: 'lineId', fieldType: 'id' },
          ],
        },
      }),
    );
    expect(doc?.definition).toEqual({
      fields: [
        { fieldName: 'amount', fieldType: 'money' },
        { fieldName: 'lineId', fieldType: 'id' },
      ],
    });
  });

  it('marks archived on Archived', () => {
    const existing: CatalogEntry = {
      _id: 'f1',
      modelId: M,
      entityType: 'businessFact',
      name: 'BudgetYearDefined',
      definition: { fields: [] },
      archived: false,
    };
    const doc = evolveCatalog(
      existing,
      ev({ type: 'BusinessFactArchived', data: { modelId: M, entityId: 'f1' } }),
    );
    expect(doc?.archived).toBe(true);
  });

  it('catalogs a command with its modelId + definition on CommandDefined', () => {
    const doc = evolveCatalog(
      null,
      ev({
        type: 'CommandDefined',
        data: {
          modelId: M,
          entityId: 'c1',
          name: 'RecordBudgetLine',
          fields: [{ fieldName: 'amount', fieldType: 'money' }],
        },
      }),
    );
    expect(doc).toEqual({
      _id: 'c1',
      modelId: M,
      entityType: 'command',
      name: 'RecordBudgetLine',
      definition: { fields: [{ fieldName: 'amount', fieldType: 'money' }] },
      archived: false,
    });
  });

  it('catalogs a readModel with its definition on ReadModelDefined', () => {
    const doc = evolveCatalog(
      null,
      ev({
        type: 'ReadModelDefined',
        data: {
          modelId: M,
          entityId: 'r1',
          name: 'Budget Summary',
          fields: [{ fieldName: 'total', fieldType: 'money' }],
        },
      }),
    );
    expect(doc).toEqual({
      _id: 'r1',
      modelId: M,
      entityType: 'readModel',
      name: 'Budget Summary',
      definition: { fields: [{ fieldName: 'total', fieldType: 'money' }] },
      archived: false,
    });
  });

  it('catalogs a wireframe with content and replaces it on ContentUpdated', () => {
    const created = evolveCatalog(
      null,
      ev({
        type: 'WireframeDefined',
        data: { modelId: M, entityId: 'w1', name: 'Entry Form', content: 'v1' },
      }),
    );
    expect(created?.definition).toEqual({ content: 'v1' });
    const updated = evolveCatalog(
      created,
      ev({
        type: 'WireframeContentUpdated',
        data: { modelId: M, entityId: 'w1', content: 'v2' },
      }),
    );
    expect(updated?.definition).toEqual({ content: 'v2' });
  });

  it('catalogs an externalBusinessFact with its type + definition', () => {
    const doc = evolveCatalog(
      null,
      ev({
        type: 'ExternalBusinessFactDefined',
        data: {
          modelId: M,
          entityId: 'x1',
          name: 'Bank Statement Received',
          fields: [{ fieldName: 'statementJson', fieldType: 'json' }],
        },
      }),
    );
    expect(doc?.entityType).toBe('externalBusinessFact');
    expect(doc?.definition).toEqual({
      fields: [{ fieldName: 'statementJson', fieldType: 'json' }],
    });
  });

  it('catalogs a slice with its type + modelId on SliceDefined (S1)', () => {
    const doc = evolveCatalog(
      null,
      ev({ type: 'SliceDefined', data: { modelId: M, sliceId: 's1', name: 'Checkout' } }),
    );
    expect(doc).toEqual({
      _id: 's1',
      modelId: M,
      entityType: 'slice',
      name: 'Checkout',
      archived: false,
    });
  });

  it('uses an empty name for an unnamed slice', () => {
    const doc = evolveCatalog(
      null,
      ev({ type: 'SliceDefined', data: { modelId: M, sliceId: 's2' } }),
    );
    expect(doc?.name).toBe('');
  });

  it('stamps definedAtPosition from metadata.globalPosition as a Number (BigInt-safe)', () => {
    const withMeta = {
      type: 'BusinessFactDefined',
      data: { modelId: M, entityId: 'f9', name: 'X', fields: [] },
      metadata: { globalPosition: 42n },
    } as unknown as ReadEvent<CatalogEvent>;
    const doc = evolveCatalog(null, withMeta);
    expect(doc?.definedAtPosition).toBe(42);
    // BigInt must never leak into the doc — Pongo's JSON write would throw.
    expect(typeof doc?.definedAtPosition).toBe('number');
  });

  it('stamps definedAtPosition on SliceDefined too (drives W3 tiling order)', () => {
    const withMeta = {
      type: 'SliceDefined',
      data: { modelId: M, sliceId: 's9', name: 'S' },
      metadata: { globalPosition: 7n },
    } as unknown as ReadEvent<CatalogEvent>;
    const doc = evolveCatalog(null, withMeta);
    expect(doc?.definedAtPosition).toBe(7);
  });

  it('leaves definedAtPosition undefined when metadata is absent', () => {
    const doc = evolveCatalog(
      null,
      ev({ type: 'CommandDefined', data: { modelId: M, entityId: 'c9', name: 'C', fields: [] } }),
    );
    expect(doc?.definedAtPosition).toBeUndefined();
  });
});
