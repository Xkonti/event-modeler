import type { Event } from '@event-driven-io/emmett';

/**
 * Relation entity events. One stream per relation: `relation-{relationId}`,
 * referencing both endpoint IDs. Relations carry NO name → exempt from
 * `entity_names`. The relation KIND is STORED (F4) — validated against the
 * 11-pair allow-list at the API edge — and `meta` is an open bag for future
 * layers (field-mapping notes etc.). Every event carries `modelId` (F1).
 *
 * Mutation events are stamped with `fromId`/`toId`/`kind` from state so the
 * inline `relation_pairs` constraint (no duplicate (from,to,kind) — E3) can
 * re-key/free without reading other streams. Removal is an event, not a row drop.
 */
export type RelationMeta = Record<string, unknown>;

export type RelationDrawn = Event<
  'RelationDrawn',
  {
    modelId: string;
    relationId: string;
    fromId: string;
    toId: string;
    kind: string;
    meta?: RelationMeta;
  }
>;

export type RelationInfoUpdated = Event<
  'RelationInfoUpdated',
  {
    modelId: string;
    relationId: string;
    fromId: string;
    toId: string;
    kind: string;
    meta?: RelationMeta;
  }
>;

export type RelationRemoved = Event<
  'RelationRemoved',
  { modelId: string; relationId: string }
>;

export type RelationEvent = RelationDrawn | RelationInfoUpdated | RelationRemoved;
