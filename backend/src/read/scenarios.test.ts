import { describe, expect, it } from 'bun:test';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { ScenarioEvent } from '../domain/scenario/events.ts';
import { evolveScenarios, type ScenarioDoc } from './scenarios.ts';

/** Pure fold test for the scenarios read model (F6 index). */
const ev = (e: ScenarioEvent): ReadEvent<ScenarioEvent> => e as ReadEvent<ScenarioEvent>;

const M = 'm-budget';

describe('evolveScenarios', () => {
  it('creates a document with the referencedEntityIds index on Defined (F6)', () => {
    const doc = evolveScenarios(
      null,
      ev({
        type: 'ScenarioDefined',
        data: {
          modelId: M,
          scenarioId: 'sc1',
          kind: 'GWT',
          anchorId: 'cmd1',
          given: [{ factId: 'f1' }],
          when: { values: {} },
          then: { emit: [{ factId: 'f2' }] },
        },
      }),
    );
    expect(doc?._id).toBe('sc1');
    expect(doc?.referencedEntityIds.sort()).toEqual(['cmd1', 'f1', 'f2']);
    expect(doc?.archived).toBe(false);
  });

  it('recomputes the index on Updated', () => {
    const base = evolveScenarios(
      null,
      ev({
        type: 'ScenarioDefined',
        data: {
          modelId: M,
          scenarioId: 'sc1',
          kind: 'GWT',
          anchorId: 'cmd1',
          given: [{ factId: 'f1' }],
          when: {},
          then: { reject: {} },
        },
      }),
    );
    const doc = evolveScenarios(
      base,
      ev({
        type: 'ScenarioUpdated',
        data: {
          modelId: M,
          scenarioId: 'sc1',
          kind: 'GWT',
          anchorId: 'cmd1',
          given: [],
          when: {},
          then: { error: { factId: 'fErr' } },
        },
      }),
    );
    expect(doc?.referencedEntityIds.sort()).toEqual(['cmd1', 'fErr']);
  });

  it('marks archived on Archived (document kept)', () => {
    const base: ScenarioDoc = {
      _id: 'sc1',
      modelId: M,
      kind: 'GT',
      anchorId: 'rm1',
      given: [],
      then: { state: {} },
      referencedEntityIds: ['rm1'],
      archived: false,
    };
    const doc = evolveScenarios(
      base,
      ev({ type: 'ScenarioArchived', data: { modelId: M, scenarioId: 'sc1' } }),
    );
    expect(doc?.archived).toBe(true);
  });
});
