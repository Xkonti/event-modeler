import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './readModel.ts';

/**
 * Unit tests for the read-model-entity decider — within-stream invariants only
 * (em-scenarios Flow 1). Lane-agnostic; holds a `fields` schema. Per-model name
 * uniqueness is the inline constraint (integration suite), not here.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const M = 'm-budget';
const defined = {
  type: 'ReadModelDefined' as const,
  data: {
    modelId: M,
    entityId: 'r1',
    name: 'Budget Summary',
    fields: [{ fieldName: 'total', fieldType: 'money' }],
  },
};
const archived = {
  type: 'ReadModelArchived' as const,
  data: { modelId: M, entityId: 'r1' },
};

describe('readModel decider', () => {
  it('defines a read model (with fields) from empty', () => {
    given([])
      .when({ type: 'DefineReadModel', data: defined.data })
      .then([defined]);
  });

  it('rejects a blank name on define (G-C1)', () => {
    given([])
      .when({
        type: 'DefineReadModel',
        data: { modelId: M, entityId: 'r1', name: ' ', fields: [] },
      })
      .thenThrows();
  });

  it('rejects duplicate field names in a definition', () => {
    given([])
      .when({
        type: 'DefineReadModel',
        data: {
          modelId: M,
          entityId: 'r1',
          name: 'X',
          fields: [
            { fieldName: 'total', fieldType: 'money' },
            { fieldName: 'Total', fieldType: 'eur' },
          ],
        },
      })
      .thenThrows();
  });

  it('rejects defining an already-defined read model', () => {
    given([defined])
      .when({
        type: 'DefineReadModel',
        data: { modelId: M, entityId: 'r1', name: 'Other', fields: [] },
      })
      .thenThrows();
  });

  it('renames an active read model (modelId stamped from state)', () => {
    given([defined])
      .when({ type: 'RenameReadModel', data: { entityId: 'r1', name: 'Budget Totals' } })
      .then([
        {
          type: 'ReadModelRenamed',
          data: { modelId: M, entityId: 'r1', name: 'Budget Totals' },
        },
      ]);
  });

  it('updates fields with full-replace semantics (mode preserved — F7)', () => {
    given([defined])
      .when({
        type: 'UpdateReadModelFields',
        data: { entityId: 'r1', fields: [{ fieldName: 'count', fieldType: 'number' }] },
      })
      .then([
        {
          type: 'ReadModelFieldsUpdated',
          data: {
            modelId: M,
            entityId: 'r1',
            fields: [{ fieldName: 'count', fieldType: 'number' }],
            // pre-F7 define carried no mode → state defaulted to projected
            mode: 'projected',
          },
        },
      ]);
  });

  it('defines a live read model (F7 mode passthrough)', () => {
    given([])
      .when({
        type: 'DefineReadModel',
        data: { modelId: M, entityId: 'r2', name: 'model_export', fields: [], mode: 'live' },
      })
      .then([
        {
          type: 'ReadModelDefined',
          data: { modelId: M, entityId: 'r2', name: 'model_export', fields: [], mode: 'live' },
        },
      ]);
  });

  it('switches mode via UpdateReadModelFields (F7)', () => {
    given([defined])
      .when({
        type: 'UpdateReadModelFields',
        data: { entityId: 'r1', fields: defined.data.fields, mode: 'live' },
      })
      .then([
        {
          type: 'ReadModelFieldsUpdated',
          data: { modelId: M, entityId: 'r1', fields: defined.data.fields, mode: 'live' },
        },
      ]);
  });

  it('rejects updating fields of an archived read model (G-C5)', () => {
    given([defined, archived])
      .when({ type: 'UpdateReadModelFields', data: { entityId: 'r1', fields: [] } })
      .thenThrows();
  });

  it('archives an active read model', () => {
    given([defined])
      .when({ type: 'ArchiveReadModel', data: { entityId: 'r1' } })
      .then([archived]);
  });

  it('rejects archiving an already-archived read model (G-C6)', () => {
    given([defined, archived])
      .when({ type: 'ArchiveReadModel', data: { entityId: 'r1' } })
      .thenThrows();
  });
});
