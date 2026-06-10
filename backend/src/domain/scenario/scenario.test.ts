import { describe, expect, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './scenario.ts';
import { referencedEntityIds } from './events.ts';

/**
 * Unit tests for the scenario decider — within-stream invariants (define-once,
 * GWT-needs-When / GT-forbids-When, kind immutable on update, archive terminal)
 * plus the F6 reference-extraction helper. Soft refs by design: no existence
 * checks anywhere here.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const M = 'm-budget';
const gwtBody = {
  anchorId: 'cmd1',
  given: [{ factId: 'f1', values: { amount: 100 } }],
  when: { values: { amount: 250 } },
  then: { emit: [{ factId: 'f2', values: { amount: 250 } }] },
};
const gwtDefined = {
  type: 'ScenarioDefined' as const,
  data: { modelId: M, scenarioId: 'sc1', kind: 'GWT' as const, ...gwtBody },
};

describe('scenario decider', () => {
  it('defines a GWT scenario', () => {
    given([])
      .when({ type: 'DefineScenario', data: gwtDefined.data })
      .then([gwtDefined]);
  });

  it('defines a GT scenario (no When)', () => {
    const body = {
      anchorId: 'rm1',
      given: [{ factId: 'f1' }],
      then: { state: { total: 100 } },
    };
    given([])
      .when({
        type: 'DefineScenario',
        data: { modelId: M, scenarioId: 'sc2', kind: 'GT', ...body },
      })
      .then([
        {
          type: 'ScenarioDefined',
          data: { modelId: M, scenarioId: 'sc2', kind: 'GT', when: undefined, ...body },
        },
      ]);
  });

  it('rejects a GWT without a When clause', () => {
    given([])
      .when({
        type: 'DefineScenario',
        data: {
          modelId: M,
          scenarioId: 'sc1',
          kind: 'GWT',
          anchorId: 'cmd1',
          given: [],
          then: { reject: {} },
        },
      })
      .thenThrows();
  });

  it('rejects a GT WITH a When clause', () => {
    given([])
      .when({
        type: 'DefineScenario',
        data: {
          modelId: M,
          scenarioId: 'sc1',
          kind: 'GT',
          anchorId: 'rm1',
          given: [],
          when: {},
          then: { state: {} },
        },
      })
      .thenThrows();
  });

  it('rejects a blank anchor', () => {
    given([])
      .when({
        type: 'DefineScenario',
        data: { ...gwtDefined.data, anchorId: ' ' },
      })
      .thenThrows();
  });

  it('updates an active scenario, kind preserved from state', () => {
    const next = {
      anchorId: 'cmd1',
      given: [],
      when: { values: {} },
      then: { reject: { reason: 'limit reached' } },
    };
    given([gwtDefined])
      .when({ type: 'UpdateScenario', data: { scenarioId: 'sc1', ...next } })
      .then([
        {
          type: 'ScenarioUpdated',
          data: { modelId: M, scenarioId: 'sc1', kind: 'GWT', ...next },
        },
      ]);
  });

  it('re-validates kind shape on update (GWT update without When rejects)', () => {
    given([gwtDefined])
      .when({
        type: 'UpdateScenario',
        data: { scenarioId: 'sc1', anchorId: 'cmd1', given: [], then: { reject: {} } },
      })
      .thenThrows();
  });

  it('archives an active scenario; further updates reject', () => {
    given([gwtDefined])
      .when({ type: 'ArchiveScenario', data: { scenarioId: 'sc1' } })
      .then([{ type: 'ScenarioArchived', data: { modelId: M, scenarioId: 'sc1' } }]);
    given([
      gwtDefined,
      { type: 'ScenarioArchived', data: { modelId: M, scenarioId: 'sc1' } },
    ])
      .when({ type: 'UpdateScenario', data: { scenarioId: 'sc1', ...gwtBody } })
      .thenThrows();
  });
});

describe('referencedEntityIds (F6)', () => {
  it('unions anchor + given + emitted facts, deduplicated', () => {
    expect(
      referencedEntityIds({
        anchorId: 'cmd1',
        given: [{ factId: 'f1' }, { factId: 'f2' }, { factId: 'f1' }],
        when: {},
        then: { emit: [{ factId: 'f2' }, { factId: 'f3' }] },
      }).sort(),
    ).toEqual(['cmd1', 'f1', 'f2', 'f3']);
  });

  it('includes the error fact for explicit-failure scenarios', () => {
    expect(
      referencedEntityIds({
        anchorId: 'cmd1',
        given: [],
        then: { error: { factId: 'fErr' } },
      }).sort(),
    ).toEqual(['cmd1', 'fErr']);
  });

  it('a reject-then references only the anchor + givens', () => {
    expect(
      referencedEntityIds({
        anchorId: 'cmd1',
        given: [{ factId: 'f1' }],
        then: { reject: {} },
      }).sort(),
    ).toEqual(['cmd1', 'f1']);
  });
});
