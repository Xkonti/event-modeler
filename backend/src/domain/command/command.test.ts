import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './command.ts';

/**
 * Unit tests for the command-entity decider — within-stream invariants only
 * (em-scenarios Flow 1). Commands are lane-agnostic (no context); they hold a
 * `fields` schema like a fact. Per-model name uniqueness is the inline constraint
 * (integration suite), not here.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const M = 'm-budget';
const defined = {
  type: 'CommandDefined' as const,
  data: {
    modelId: M,
    entityId: 'c1',
    name: 'Record Budget Line',
    fields: [{ fieldName: 'amount', fieldType: 'money' }],
  },
};
const archived = {
  type: 'CommandArchived' as const,
  data: { modelId: M, entityId: 'c1' },
};

describe('command decider', () => {
  it('defines a command (with fields) from empty', () => {
    given([])
      .when({ type: 'DefineCommand', data: defined.data })
      .then([defined]);
  });

  it('allows a zero-field command', () => {
    given([])
      .when({
        type: 'DefineCommand',
        data: { modelId: M, entityId: 'c1', name: 'X', fields: [] },
      })
      .then([
        {
          type: 'CommandDefined',
          data: { modelId: M, entityId: 'c1', name: 'X', fields: [] },
        },
      ]);
  });

  it('rejects a blank name on define (G-C1)', () => {
    given([])
      .when({
        type: 'DefineCommand',
        data: { modelId: M, entityId: 'c1', name: '  ', fields: [] },
      })
      .thenThrows();
  });

  it('rejects duplicate field names in a definition', () => {
    given([])
      .when({
        type: 'DefineCommand',
        data: {
          modelId: M,
          entityId: 'c1',
          name: 'X',
          fields: [
            { fieldName: 'amount', fieldType: 'money' },
            { fieldName: 'amount', fieldType: 'eur' },
          ],
        },
      })
      .thenThrows();
  });

  it('rejects defining an already-defined command', () => {
    given([defined])
      .when({
        type: 'DefineCommand',
        data: { modelId: M, entityId: 'c1', name: 'Other', fields: [] },
      })
      .thenThrows();
  });

  it('renames an active command (modelId stamped from state)', () => {
    given([defined])
      .when({ type: 'RenameCommand', data: { entityId: 'c1', name: 'Submit Order' } })
      .then([
        {
          type: 'CommandRenamed',
          data: { modelId: M, entityId: 'c1', name: 'Submit Order' },
        },
      ]);
  });

  it('rejects renaming a command that is not defined', () => {
    given([])
      .when({ type: 'RenameCommand', data: { entityId: 'c1', name: 'X' } })
      .thenThrows();
  });

  it('updates fields with full-replace semantics', () => {
    given([defined])
      .when({
        type: 'UpdateCommandFields',
        data: {
          entityId: 'c1',
          fields: [
            { fieldName: 'amount', fieldType: 'money' },
            { fieldName: 'lineId', fieldType: 'id' },
          ],
        },
      })
      .then([
        {
          type: 'CommandFieldsUpdated',
          data: {
            modelId: M,
            entityId: 'c1',
            fields: [
              { fieldName: 'amount', fieldType: 'money' },
              { fieldName: 'lineId', fieldType: 'id' },
            ],
          },
        },
      ]);
  });

  it('rejects updating fields of an archived command (G-C5)', () => {
    given([defined, archived])
      .when({ type: 'UpdateCommandFields', data: { entityId: 'c1', fields: [] } })
      .thenThrows();
  });

  it('archives an active command', () => {
    given([defined])
      .when({ type: 'ArchiveCommand', data: { entityId: 'c1' } })
      .then([archived]);
  });

  it('rejects archiving an already-archived command (G-C6)', () => {
    given([defined, archived])
      .when({ type: 'ArchiveCommand', data: { entityId: 'c1' } })
      .thenThrows();
  });
});
