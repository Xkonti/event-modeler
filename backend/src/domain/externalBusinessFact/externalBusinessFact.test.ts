import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './externalBusinessFact.ts';

/**
 * Unit tests for the external-business-fact decider — within-stream invariants
 * only (em-scenarios Flow 1). Identical rules to the internal fact; the
 * external/internal distinction is type + rendering, not behaviour. Lane
 * assignment is X1 (same path as internal facts, O5) — not in this vertical.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const M = 'm-budget';
const defined = {
  type: 'ExternalBusinessFactDefined' as const,
  data: {
    modelId: M,
    entityId: 'x1',
    name: 'Bank Statement Received',
    fields: [{ fieldName: 'statementJson', fieldType: 'json' }],
  },
};
const archived = {
  type: 'ExternalBusinessFactArchived' as const,
  data: { modelId: M, entityId: 'x1' },
};

describe('externalBusinessFact decider', () => {
  it('defines an external fact (with fields) from empty', () => {
    given([])
      .when({ type: 'DefineExternalBusinessFact', data: defined.data })
      .then([defined]);
  });

  it('rejects a blank name on define (G-C1)', () => {
    given([])
      .when({
        type: 'DefineExternalBusinessFact',
        data: { modelId: M, entityId: 'x1', name: ' ', fields: [] },
      })
      .thenThrows();
  });

  it('rejects duplicate field names in a definition', () => {
    given([])
      .when({
        type: 'DefineExternalBusinessFact',
        data: {
          modelId: M,
          entityId: 'x1',
          name: 'X',
          fields: [
            { fieldName: 'a', fieldType: 't' },
            { fieldName: 'a', fieldType: 'u' },
          ],
        },
      })
      .thenThrows();
  });

  it('rejects defining an already-defined external fact', () => {
    given([defined])
      .when({
        type: 'DefineExternalBusinessFact',
        data: { modelId: M, entityId: 'x1', name: 'Other', fields: [] },
      })
      .thenThrows();
  });

  it('renames an active external fact (modelId stamped from state)', () => {
    given([defined])
      .when({
        type: 'RenameExternalBusinessFact',
        data: { entityId: 'x1', name: 'Statement Received' },
      })
      .then([
        {
          type: 'ExternalBusinessFactRenamed',
          data: { modelId: M, entityId: 'x1', name: 'Statement Received' },
        },
      ]);
  });

  it('updates fields with full-replace semantics', () => {
    given([defined])
      .when({
        type: 'UpdateExternalBusinessFactFields',
        data: { entityId: 'x1', fields: [{ fieldName: 'rows', fieldType: 'array' }] },
      })
      .then([
        {
          type: 'ExternalBusinessFactFieldsUpdated',
          data: {
            modelId: M,
            entityId: 'x1',
            fields: [{ fieldName: 'rows', fieldType: 'array' }],
          },
        },
      ]);
  });

  it('rejects updating fields of an archived external fact (G-C5)', () => {
    given([defined, archived])
      .when({
        type: 'UpdateExternalBusinessFactFields',
        data: { entityId: 'x1', fields: [] },
      })
      .thenThrows();
  });

  it('archives an active external fact', () => {
    given([defined])
      .when({ type: 'ArchiveExternalBusinessFact', data: { entityId: 'x1' } })
      .then([archived]);
  });

  it('rejects archiving an already-archived external fact (G-C6)', () => {
    given([defined, archived])
      .when({ type: 'ArchiveExternalBusinessFact', data: { entityId: 'x1' } })
      .thenThrows();
  });
});
