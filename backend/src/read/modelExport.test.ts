import { describe, expect, it } from 'bun:test';
import { assembleExport, EXPORT_SCHEMA_VERSION } from './modelExport.ts';
import type { CatalogEntry } from './entityCatalog.ts';
import type { ScenarioDoc } from './scenarios.ts';
import type { SlicePlacementsDoc } from './slicePlacements.ts';

/** Unit tests for the export assembler — pure function, no database. */

const M = 'm-1';

const entry = (over: Partial<CatalogEntry> & { _id: string }): CatalogEntry => ({
  modelId: M,
  entityType: 'businessFact',
  name: over._id,
  archived: false,
  ...over,
});

const baseInput = {
  model: { _id: M, name: 'Budgeting', archived: false, sliceCount: 1 },
  entries: [] as CatalogEntry[],
  contexts: [],
  slices: [] as SlicePlacementsDoc[],
  relations: [],
  scenarios: [] as ScenarioDoc[],
  exportedAt: '2026-06-10T00:00:00.000Z',
};

describe('assembleExport', () => {
  it('stamps schemaVersion + exportedAt + model header', () => {
    const out = assembleExport(baseInput);
    expect(out.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(out.exportedAt).toBe('2026-06-10T00:00:00.000Z');
    expect(out.model).toEqual({ id: M, name: 'Budgeting' });
  });

  it('excludes archived items everywhere (current state, not history)', () => {
    const out = assembleExport({
      ...baseInput,
      entries: [
        entry({ _id: 'f1' }),
        entry({ _id: 'f2', archived: true }),
        entry({ _id: 's1', entityType: 'slice', archived: true }),
      ],
      contexts: [
        { _id: 'c1', modelId: M, name: 'Budget', archived: false },
        { _id: 'c2', modelId: M, name: 'Old', archived: true },
      ],
      slices: [
        { _id: 's1', modelId: M, name: 'S', placements: [], archived: true },
      ],
      scenarios: [
        {
          _id: 'sc1',
          modelId: M,
          kind: 'GWT',
          anchorId: 'cmd1',
          given: [],
          then: { emit: [] },
          referencedEntityIds: [],
          archived: true,
        } as unknown as ScenarioDoc,
      ],
    });
    expect(out.entities.map((e) => e.id)).toEqual(['f1']);
    expect(out.contexts).toEqual([{ id: 'c1', name: 'Budget' }]);
    expect(out.slices).toEqual([]);
    expect(out.scenarios).toEqual([]);
  });

  it('keeps slices out of entities and orders both by definedAtPosition', () => {
    const out = assembleExport({
      ...baseInput,
      entries: [
        entry({ _id: 'f-late', definedAtPosition: 30 }),
        entry({ _id: 'f-early', definedAtPosition: 10 }),
        entry({ _id: 'slice-b', entityType: 'slice', definedAtPosition: 25 }),
        entry({ _id: 'slice-a', entityType: 'slice', definedAtPosition: 5 }),
      ],
      slices: [
        { _id: 'slice-b', modelId: M, placements: [], archived: false },
        { _id: 'slice-a', modelId: M, placements: [], archived: false },
      ],
    });
    expect(out.entities.map((e) => e.id)).toEqual(['f-early', 'f-late']);
    expect(out.slices.map((s) => s.id)).toEqual(['slice-a', 'slice-b']);
  });

  it('maps placements to {entityId, slotRole, slot?} and keeps contextId/definition on entities', () => {
    const out = assembleExport({
      ...baseInput,
      entries: [
        entry({
          _id: 'f1',
          definition: { fields: [{ fieldName: 'amount', fieldType: 'money' }] },
          contextId: 'c1',
        }),
      ],
      slices: [
        {
          _id: 's1',
          modelId: M,
          name: 'Record line',
          placements: [
            {
              placedEntityId: 'f1',
              entityType: 'businessFact',
              slotRole: 'fact',
              slot: 0,
            },
            {
              placedEntityId: 'a1',
              entityType: 'automation',
              slotRole: 'trigger',
            },
          ],
          archived: false,
        } as unknown as SlicePlacementsDoc,
      ],
    });
    expect(out.entities[0]).toEqual({
      id: 'f1',
      entityType: 'businessFact',
      name: 'f1',
      definition: { fields: [{ fieldName: 'amount', fieldType: 'money' }] },
      contextId: 'c1',
    });
    expect(out.slices[0]?.placements).toEqual([
      { entityId: 'f1', slotRole: 'fact', slot: 0 },
      { entityId: 'a1', slotRole: 'trigger' },
    ]);
  });

  it('exports chapters in creation order + chapterId on slices (C1)', () => {
    const out = assembleExport({
      ...baseInput,
      chapters: [
        { _id: 'ch-late', modelId: M, name: 'Rules', archived: false, definedAtPosition: 20 },
        { _id: 'ch-early', modelId: M, name: 'Setup', archived: false, definedAtPosition: 5 },
        { _id: 'ch-gone', modelId: M, name: 'Old', archived: true, definedAtPosition: 1 },
      ],
      slices: [
        {
          _id: 's1',
          modelId: M,
          name: 'Create Model',
          chapterId: 'ch-early',
          placements: [],
          archived: false,
        },
      ],
      entries: [entry({ _id: 's1', entityType: 'slice' })],
    });
    expect(out.chapters).toEqual([
      { id: 'ch-early', name: 'Setup' },
      { id: 'ch-late', name: 'Rules' },
    ]);
    expect(out.slices[0]?.chapterId).toBe('ch-early');
  });

  it('exports relations with stored kind + meta, sorted by id', () => {
    const out = assembleExport({
      ...baseInput,
      relations: [
        { _id: 'r2', modelId: M, fromId: 'w1', toId: 'c1', kind: 'issues' },
        {
          _id: 'r1',
          modelId: M,
          fromId: 'c1',
          toId: 'f1',
          kind: 'produces',
          meta: { note: 'x' },
        },
      ],
    });
    expect(out.relations.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(out.relations[0]).toEqual({
      id: 'r1',
      fromId: 'c1',
      toId: 'f1',
      kind: 'produces',
      meta: { note: 'x' },
    });
  });
});
