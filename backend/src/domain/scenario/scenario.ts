import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { ScenarioBody, ScenarioEvent, ScenarioKind } from './events.ts';
import { isBlank } from '../../shared/fields.ts';

/**
 * Decider for a single scenario stream. Within-stream invariants: define-once,
 * well-formed shape per kind (GWT needs a When; GT must NOT have one), non-blank
 * anchor, edit-only-while-active. `kind` is immutable after define (a GT is a
 * different rule than a GWT, not an edit of one).
 *
 * Deliberately NO reference checks: scenario refs are soft (dangling allowed,
 * flagged out-of-sync at read time, G-C10 — validation never gates).
 */

// --- State ---------------------------------------------------------------

export type Scenario =
  | { status: 'empty' }
  | { status: 'active'; modelId: string; scenarioId: string; kind: ScenarioKind }
  | { status: 'archived'; modelId: string; scenarioId: string };

export const initialState = (): Scenario => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineScenario = Command<
  'DefineScenario',
  { modelId: string; scenarioId: string; kind: ScenarioKind } & ScenarioBody
>;
export type UpdateScenario = Command<
  'UpdateScenario',
  { scenarioId: string } & ScenarioBody
>;
export type ArchiveScenario = Command<'ArchiveScenario', { scenarioId: string }>;

export type ScenarioCommand = DefineScenario | UpdateScenario | ArchiveScenario;

const KINDS: ScenarioKind[] = ['GWT', 'GT'];

const assertWellFormed = (kind: ScenarioKind, body: ScenarioBody): void => {
  if (!KINDS.includes(kind))
    throw new IllegalStateError(`Scenario kind must be one of: ${KINDS.join(', ')}`);
  if (isBlank(body.anchorId))
    throw new IllegalStateError('Scenario anchor must not be blank');
  if (!Array.isArray(body.given))
    throw new IllegalStateError('Scenario given must be a list');
  if (kind === 'GWT' && body.when === undefined)
    throw new IllegalStateError('A GWT scenario requires a When clause');
  if (kind === 'GT' && body.when !== undefined)
    throw new IllegalStateError('A GT scenario must not have a When clause');
  if (body.then === undefined || body.then === null)
    throw new IllegalStateError('Scenario requires a Then clause');
};

// --- Decide --------------------------------------------------------------

export const decide = (
  command: ScenarioCommand,
  state: Scenario,
): ScenarioEvent => {
  switch (command.type) {
    case 'DefineScenario': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Scenario already defined');
      const { modelId, scenarioId, kind, anchorId, given, when, then } = command.data;
      assertWellFormed(kind, { anchorId, given, when, then });
      return {
        type: 'ScenarioDefined',
        data: { modelId, scenarioId, kind, anchorId, given, when, then },
      };
    }
    case 'UpdateScenario': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only update an active scenario');
      const { anchorId, given, when, then } = command.data;
      // kind is immutable — re-validate the new body against the defined kind.
      assertWellFormed(state.kind, { anchorId, given, when, then });
      return {
        type: 'ScenarioUpdated',
        data: {
          modelId: state.modelId,
          scenarioId: state.scenarioId,
          kind: state.kind,
          anchorId,
          given,
          when,
          then,
        },
      };
    }
    case 'ArchiveScenario': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active scenario');
      return {
        type: 'ScenarioArchived',
        data: { modelId: state.modelId, scenarioId: state.scenarioId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: Scenario, event: ScenarioEvent): Scenario => {
  switch (event.type) {
    case 'ScenarioDefined':
      return {
        status: 'active',
        modelId: event.data.modelId,
        scenarioId: event.data.scenarioId,
        kind: event.data.kind,
      };
    case 'ScenarioUpdated':
      return state;
    case 'ScenarioArchived':
      return {
        status: 'archived',
        modelId: event.data.modelId,
        scenarioId: event.data.scenarioId,
      };
  }
};
