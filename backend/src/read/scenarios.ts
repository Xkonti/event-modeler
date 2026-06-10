import { pongoMultiStreamProjection } from '@event-driven-io/emmett-postgresql';
import type { ReadEvent } from '@event-driven-io/emmett';
import {
  referencedEntityIds,
  type GivenStep,
  type ScenarioEvent,
  type ScenarioKind,
  type ThenClause,
  type WhenClause,
} from '../domain/scenario/events.ts';

/**
 * READ MODEL — the scenarios catalog (one document per rule), built ASYNC from
 * the global log. `referencedEntityIds` is the F6 index: the anchor + every
 * given/then fact id, so the canvas can auto-surface rules for visible entities
 * and queries can ask "which rules touch X?".
 *
 * `outOfSync` is NOT stored — it depends on OTHER entities' liveness, which
 * would rot in a stored column. It is derived at read time by checking each
 * referenced id against the catalog (scenario GET / validation A3).
 *
 * Archived scenarios keep their document (`archived: true`) — second-class but
 * inspectable, consistent with the rest of the catalog.
 */
export type ScenarioDoc = {
  _id: string;
  modelId: string;
  kind: ScenarioKind;
  anchorId: string;
  given: GivenStep[];
  when?: WhenClause;
  then: ThenClause;
  referencedEntityIds: string[];
  archived: boolean;
};

/** Pure fold — exported for unit testing without a database. */
export const evolveScenarios = (
  document: ScenarioDoc | null,
  event: ReadEvent<ScenarioEvent>,
): ScenarioDoc | null => {
  switch (event.type) {
    case 'ScenarioDefined':
    case 'ScenarioUpdated': {
      const { modelId, scenarioId, kind, anchorId, given, when, then } = event.data;
      return {
        _id: scenarioId,
        modelId,
        kind,
        anchorId,
        given,
        when,
        then,
        referencedEntityIds: referencedEntityIds({ anchorId, given, when, then }),
        archived: document?.archived ?? false,
      };
    }
    case 'ScenarioArchived':
      return document ? { ...document, archived: true } : null;
  }
};

export const scenariosProjection = pongoMultiStreamProjection<
  ScenarioDoc,
  ScenarioEvent
>({
  collectionName: 'scenarios',
  canHandle: ['ScenarioDefined', 'ScenarioUpdated', 'ScenarioArchived'],
  getDocumentId: (event) => event.data.scenarioId,
  evolve: evolveScenarios,
});
