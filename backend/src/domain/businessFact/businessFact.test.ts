import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './businessFact.ts';

/**
 * Unit tests for the decider — pure GIVEN events / WHEN command / THEN events,
 * no database. The within-stream invariants of em-scenarios Flow 1 (define-once,
 * non-blank name, no duplicate field names, full-replace fields, archive
 * terminal). Per-model name uniqueness is the inline constraint — tested in the
 * integration suite, not here.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const M = 'm-budget';
const defined = {
  type: 'BusinessFactDefined' as const,
  data: {
    modelId: M,
    entityId: 'f1',
    name: 'Budget Line Recorded',
    fields: [{ fieldName: 'amount', fieldType: 'money' }],
  },
};
const archived = {
  type: 'BusinessFactArchived' as const,
  data: { modelId: M, entityId: 'f1' },
};

describe('businessFact decider', () => {
  it('defines a fact (with fields) from empty', () => {
    given([])
      .when({ type: 'DefineBusinessFact', data: defined.data })
      .then([defined]);
  });

  it('allows a zero-field fact (fields added later)', () => {
    given([])
      .when({
        type: 'DefineBusinessFact',
        data: { modelId: M, entityId: 'f1', name: 'X', fields: [] },
      })
      .then([
        {
          type: 'BusinessFactDefined',
          data: { modelId: M, entityId: 'f1', name: 'X', fields: [] },
        },
      ]);
  });

  it('rejects a blank name on define (G-C1)', () => {
    given([])
      .when({
        type: 'DefineBusinessFact',
        data: { modelId: M, entityId: 'f1', name: '   ', fields: [] },
      })
      .thenThrows();
  });

  it('rejects duplicate field names in a definition', () => {
    given([])
      .when({
        type: 'DefineBusinessFact',
        data: {
          modelId: M,
          entityId: 'f1',
          name: 'X',
          fields: [
            { fieldName: 'amount', fieldType: 'money' },
            { fieldName: 'amount', fieldType: 'eur' },
          ],
        },
      })
      .thenThrows();
  });

  it('rejects defining an already-defined fact', () => {
    given([defined])
      .when({
        type: 'DefineBusinessFact',
        data: { modelId: M, entityId: 'f1', name: 'Other', fields: [] },
      })
      .thenThrows();
  });

  it('renames an active fact (modelId stamped from state)', () => {
    given([defined])
      .when({ type: 'RenameBusinessFact', data: { entityId: 'f1', name: 'Line Recorded' } })
      .then([
        {
          type: 'BusinessFactRenamed',
          data: { modelId: M, entityId: 'f1', name: 'Line Recorded' },
        },
      ]);
  });

  it('rejects a blank name on rename (G-C1)', () => {
    given([defined])
      .when({ type: 'RenameBusinessFact', data: { entityId: 'f1', name: '' } })
      .thenThrows();
  });

  it('rejects renaming a fact that is not defined (G-C4)', () => {
    given([])
      .when({ type: 'RenameBusinessFact', data: { entityId: 'f1', name: 'X' } })
      .thenThrows();
  });

  it('updates fields with full-replace semantics', () => {
    given([defined])
      .when({
        type: 'UpdateBusinessFactFields',
        data: {
          entityId: 'f1',
          fields: [
            { fieldName: 'amount', fieldType: 'money' },
            { fieldName: 'lineId', fieldType: 'id' },
          ],
        },
      })
      .then([
        {
          type: 'BusinessFactFieldsUpdated',
          data: {
            modelId: M,
            entityId: 'f1',
            fields: [
              { fieldName: 'amount', fieldType: 'money' },
              { fieldName: 'lineId', fieldType: 'id' },
            ],
          },
        },
      ]);
  });

  it('allows clearing all fields', () => {
    given([defined])
      .when({ type: 'UpdateBusinessFactFields', data: { entityId: 'f1', fields: [] } })
      .then([
        {
          type: 'BusinessFactFieldsUpdated',
          data: { modelId: M, entityId: 'f1', fields: [] },
        },
      ]);
  });

  it('rejects updating fields of an archived fact (G-C5)', () => {
    given([defined, archived])
      .when({ type: 'UpdateBusinessFactFields', data: { entityId: 'f1', fields: [] } })
      .thenThrows();
  });

  it('assigns a lane to an active fact (X1)', () => {
    given([defined])
      .when({
        type: 'AssignBusinessFactToContext',
        data: { entityId: 'f1', contextId: 'c1' },
      })
      .then([
        {
          type: 'BusinessFactAssignedToContext',
          data: { modelId: M, entityId: 'f1', contextId: 'c1', previousContextId: undefined },
        },
      ]);
  });

  it('re-assign is last-write-wins and stamps the vacated lane (E1)', () => {
    given([
      defined,
      {
        type: 'BusinessFactAssignedToContext',
        data: { modelId: M, entityId: 'f1', contextId: 'c1' },
      },
    ])
      .when({
        type: 'AssignBusinessFactToContext',
        data: { entityId: 'f1', contextId: 'c2' },
      })
      .then([
        {
          type: 'BusinessFactAssignedToContext',
          data: { modelId: M, entityId: 'f1', contextId: 'c2', previousContextId: 'c1' },
        },
      ]);
  });

  it('clears an assigned lane (stamps the cleared contextId)', () => {
    given([
      defined,
      {
        type: 'BusinessFactAssignedToContext',
        data: { modelId: M, entityId: 'f1', contextId: 'c1' },
      },
    ])
      .when({ type: 'ClearBusinessFactContext', data: { entityId: 'f1' } })
      .then([
        {
          type: 'BusinessFactContextCleared',
          data: { modelId: M, entityId: 'f1', contextId: 'c1' },
        },
      ]);
  });

  it('rejects clearing when no lane is assigned (X1 lean)', () => {
    given([defined])
      .when({ type: 'ClearBusinessFactContext', data: { entityId: 'f1' } })
      .thenThrows();
  });

  it('rejects assigning a lane to an archived fact (G-C5)', () => {
    given([defined, archived])
      .when({
        type: 'AssignBusinessFactToContext',
        data: { entityId: 'f1', contextId: 'c1' },
      })
      .thenThrows();
  });

  it('archives an active fact', () => {
    given([defined])
      .when({ type: 'ArchiveBusinessFact', data: { entityId: 'f1' } })
      .then([archived]);
  });

  it('rejects archiving an already-archived fact (G-C6)', () => {
    given([defined, archived])
      .when({ type: 'ArchiveBusinessFact', data: { entityId: 'f1' } })
      .thenThrows();
  });
});
