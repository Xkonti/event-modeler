import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './automation.ts';
import type { TriggerConfig } from './events.ts';

/**
 * Unit tests for the automation decider — within-stream invariants (define-once,
 * non-blank name, valid triggerType, full-replace reconfigure, archive terminal).
 * Cross-stream ref validity (monitored read model / issued command) is the API
 * edge's catalog pre-check — integration-tested, not here.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const M = 'm-budget';
const config: TriggerConfig = {
  triggerType: 'fact',
  monitoredReadModelId: 'rm1',
  issuedCommandId: 'cmd1',
};
const defined = {
  type: 'AutomationDefined' as const,
  data: { modelId: M, entityId: 'a1', name: 'Reorder Stock', triggerConfig: config },
};
const archived = {
  type: 'AutomationArchived' as const,
  data: { modelId: M, entityId: 'a1' },
};

describe('automation decider', () => {
  it('defines an automation with a trigger config', () => {
    given([])
      .when({ type: 'DefineAutomation', data: defined.data })
      .then([defined]);
  });

  it('rejects a blank name on define (G-C1)', () => {
    given([])
      .when({
        type: 'DefineAutomation',
        data: { modelId: M, entityId: 'a1', name: ' ', triggerConfig: config },
      })
      .thenThrows();
  });

  it('rejects an unknown trigger type', () => {
    given([])
      .when({
        type: 'DefineAutomation',
        data: {
          modelId: M,
          entityId: 'a1',
          name: 'X',
          triggerConfig: { triggerType: 'webhook' as never },
        },
      })
      .thenThrows();
  });

  it('rejects defining an already-defined automation', () => {
    given([defined])
      .when({
        type: 'DefineAutomation',
        data: { modelId: M, entityId: 'a1', name: 'Other', triggerConfig: config },
      })
      .thenThrows();
  });

  it('reconfigures with full-replace semantics (G3, modelId stamped)', () => {
    const next: TriggerConfig = { triggerType: 'timer' };
    given([defined])
      .when({ type: 'ReconfigureAutomation', data: { entityId: 'a1', triggerConfig: next } })
      .then([
        {
          type: 'AutomationReconfigured',
          data: { modelId: M, entityId: 'a1', triggerConfig: next },
        },
      ]);
  });

  it('renames an active automation', () => {
    given([defined])
      .when({ type: 'RenameAutomation', data: { entityId: 'a1', name: 'Restock' } })
      .then([
        {
          type: 'AutomationRenamed',
          data: { modelId: M, entityId: 'a1', name: 'Restock' },
        },
      ]);
  });

  it('archives an active automation', () => {
    given([defined])
      .when({ type: 'ArchiveAutomation', data: { entityId: 'a1' } })
      .then([archived]);
  });

  it('rejects reconfiguring an archived automation (G-C5)', () => {
    given([defined, archived])
      .when({
        type: 'ReconfigureAutomation',
        data: { entityId: 'a1', triggerConfig: { triggerType: 'timer' } },
      })
      .thenThrows();
  });

  it('rejects archiving an already-archived automation (G-C6)', () => {
    given([defined, archived])
      .when({ type: 'ArchiveAutomation', data: { entityId: 'a1' } })
      .thenThrows();
  });
});
