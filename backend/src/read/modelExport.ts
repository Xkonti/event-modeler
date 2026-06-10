import type { CatalogEntry } from './entityCatalog.ts';
import type { ContextDoc } from './contexts.ts';
import type { ModelDoc } from './models.ts';
import type { RelationEdgeDoc } from './relationsGraph.ts';
import type { ScenarioDoc } from './scenarios.ts';
import type { SlicePlacementsDoc } from './slicePlacements.ts';

/**
 * O1 — the whole-model export, a STATE-VIEW QUERY (no recorded fact). This is
 * the "automation-specific" serialization (notes/serialization.md): current
 * state, not history; archived items excluded (the history loss is the point);
 * version-stamped for the 3-version backward import window. v1's save /
 * round-trip path behind the W2 [Export] button.
 *
 * Pure assembler — the HTTP route only gathers collections and delegates here,
 * so the shape is unit-testable without a database.
 */
export const EXPORT_SCHEMA_VERSION = 1;

export type ModelExport = {
  schemaVersion: number;
  exportedAt: string;
  model: { id: string; name: string };
  contexts: Array<{ id: string; name: string }>;
  entities: Array<{
    id: string;
    entityType: string;
    name: string;
    definition?: CatalogEntry['definition'];
    contextId?: string;
  }>;
  slices: Array<{
    id: string;
    name?: string;
    placements: Array<{ entityId: string; slotRole: string; slot?: number }>;
  }>;
  relations: Array<{
    id: string;
    fromId: string;
    toId: string;
    kind: string;
    meta?: RelationEdgeDoc['meta'];
  }>;
  scenarios: Array<{
    id: string;
    kind: ScenarioDoc['kind'];
    anchorId: string;
    given: ScenarioDoc['given'];
    when?: ScenarioDoc['when'];
    then: ScenarioDoc['then'];
  }>;
};

/** Creation order (definedAtPosition, missing-last, `_id` tiebreak). */
const byDefinedAt = (a: CatalogEntry, b: CatalogEntry): number =>
  (a.definedAtPosition ?? Number.MAX_SAFE_INTEGER) -
    (b.definedAtPosition ?? Number.MAX_SAFE_INTEGER) ||
  a._id.localeCompare(b._id);

const byId = <T extends { _id: string }>(a: T, b: T): number =>
  a._id.localeCompare(b._id);

export const assembleExport = (input: {
  model: ModelDoc;
  entries: CatalogEntry[];
  contexts: ContextDoc[];
  slices: SlicePlacementsDoc[];
  relations: RelationEdgeDoc[];
  scenarios: ScenarioDoc[];
  exportedAt: string;
}): ModelExport => {
  const { model, entries, contexts, slices, relations, scenarios, exportedAt } =
    input;

  // Slices are cataloged for ordering but are containers, not entities — they
  // export under `slices` (from slice_placements), never under `entities`.
  const active = entries.filter((e) => !e.archived);
  const entityEntries = active
    .filter((e) => e.entityType !== 'slice')
    .sort(byDefinedAt);
  const sliceOrder = new Map(
    active
      .filter((e) => e.entityType === 'slice')
      .sort(byDefinedAt)
      .map((e, i) => [e._id, i]),
  );

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt,
    model: { id: model._id, name: model.name },
    contexts: contexts
      .filter((c) => !c.archived)
      .sort(byId)
      .map(({ _id, name }) => ({ id: _id, name })),
    entities: entityEntries.map(
      ({ _id, entityType, name, definition, contextId }) => ({
        id: _id,
        entityType,
        name,
        ...(definition !== undefined ? { definition } : {}),
        ...(contextId !== undefined ? { contextId } : {}),
      }),
    ),
    slices: slices
      .filter((s) => !s.archived)
      .sort(
        (a, b) =>
          (sliceOrder.get(a._id) ?? Number.MAX_SAFE_INTEGER) -
            (sliceOrder.get(b._id) ?? Number.MAX_SAFE_INTEGER) ||
          a._id.localeCompare(b._id),
      )
      .map((s) => ({
        id: s._id,
        ...(s.name !== undefined ? { name: s.name } : {}),
        placements: s.placements.map(({ placedEntityId, slotRole, slot }) => ({
          entityId: placedEntityId,
          slotRole,
          ...(slot !== undefined ? { slot } : {}),
        })),
      })),
    relations: relations
      .slice()
      .sort(byId)
      .map(({ _id, fromId, toId, kind, meta }) => ({
        id: _id,
        fromId,
        toId,
        kind,
        ...(meta !== undefined ? { meta } : {}),
      })),
    scenarios: scenarios
      .filter((s) => !s.archived)
      .slice()
      .sort(byId)
      .map(({ _id, kind, anchorId, given, when, then }) => ({
        id: _id,
        kind,
        anchorId,
        given,
        ...(when !== undefined ? { when } : {}),
        then,
      })),
  };
};
