import type { Event } from '@event-driven-io/emmett';

/**
 * Scenario (GWT/GT rule) events. One stream per scenario: `scenario-{scenarioId}`.
 * A scenario pins a business rule to an anchor entity with concrete example
 * data: GWT (anchor = command; Given facts, When command values, Then
 * emit/reject/error) or GT (anchor = read model / automation; Given facts, Then
 * projected state / issued effect — no When).
 *
 * All entity references are SOFT GUIDs (em-scenarios Flow 5): a scenario may
 * dangle after its targets are archived — it is flagged `outOfSync` at read
 * time, never blocked or cascaded. Scenarios carry no name → exempt from
 * `entity_names`. Every event carries `modelId` (F1).
 */
export type ScenarioKind = 'GWT' | 'GT';

export type GivenStep = {
  factId: string;
  /** false = the fact must NOT have happened (negative given). Default true. */
  exists?: boolean;
  values?: Record<string, unknown>;
};

export type WhenClause = { values?: Record<string, unknown> };

export type ThenClause =
  | { emit: Array<{ factId: string; values?: Record<string, unknown> }> }
  | { reject: { reason?: string } }
  | { error: { factId: string; values?: Record<string, unknown> } }
  | { state: Record<string, unknown> };

export type ScenarioBody = {
  anchorId: string;
  given: GivenStep[];
  when?: WhenClause;
  then: ThenClause;
};

export type ScenarioDefined = Event<
  'ScenarioDefined',
  { modelId: string; scenarioId: string; kind: ScenarioKind } & ScenarioBody
>;

export type ScenarioUpdated = Event<
  'ScenarioUpdated',
  { modelId: string; scenarioId: string; kind: ScenarioKind } & ScenarioBody
>;

export type ScenarioArchived = Event<
  'ScenarioArchived',
  { modelId: string; scenarioId: string }
>;

export type ScenarioEvent = ScenarioDefined | ScenarioUpdated | ScenarioArchived;

/**
 * Every entity id a scenario touches: the anchor + all given/then fact ids (F6).
 * The scenarios read model indexes this union so the canvas can auto-surface
 * rules for whatever is visible, and out-of-sync derivation checks each id.
 */
export const referencedEntityIds = (body: ScenarioBody): string[] => {
  const ids = new Set<string>([body.anchorId]);
  for (const step of body.given) ids.add(step.factId);
  if ('emit' in body.then) for (const e of body.then.emit) ids.add(e.factId);
  if ('error' in body.then) ids.add(body.then.error.factId);
  return [...ids];
};
