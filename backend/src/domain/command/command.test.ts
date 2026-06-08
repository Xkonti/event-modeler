import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './command.ts';

/** Unit tests for the command-entity decider — within-stream invariants only. */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const defined = {
  type: 'CommandDefined' as const,
  data: { entityId: 'c1', name: 'PlaceOrder', context: 'Ordering' },
};

describe('command decider', () => {
  it('defines a command from empty', () => {
    given([])
      .when({
        type: 'DefineCommand',
        data: { entityId: 'c1', name: 'PlaceOrder', context: 'Ordering' },
      })
      .then([defined]);
  });

  it('rejects defining an already-defined command', () => {
    given([defined])
      .when({
        type: 'DefineCommand',
        data: { entityId: 'c1', name: 'Other', context: 'Ordering' },
      })
      .thenThrows();
  });

  it('renames an active command', () => {
    given([defined])
      .when({ type: 'RenameCommand', data: { entityId: 'c1', name: 'SubmitOrder' } })
      .then([
        { type: 'CommandRenamed', data: { entityId: 'c1', name: 'SubmitOrder' } },
      ]);
  });

  it('rejects renaming a command that is not defined', () => {
    given([])
      .when({ type: 'RenameCommand', data: { entityId: 'c1', name: 'X' } })
      .thenThrows();
  });

  it('archives an active command', () => {
    given([defined])
      .when({ type: 'ArchiveCommand', data: { entityId: 'c1' } })
      .then([{ type: 'CommandArchived', data: { entityId: 'c1' } }]);
  });

  it('rejects archiving an already-archived command', () => {
    given([defined, { type: 'CommandArchived', data: { entityId: 'c1' } }])
      .when({ type: 'ArchiveCommand', data: { entityId: 'c1' } })
      .thenThrows();
  });
});
