import type { Event } from '@event-driven-io/emmett';

/**
 * Relation entity events. One stream per relation: `relation-{entityId}`,
 * referencing both endpoint IDs. Relations carry NO name → exempt from
 * `entity_names`. The relation KIND is NOT stored — it is derived from the ordered
 * endpoint type-pair (shared/relationKind.ts). Removal is an event, not a row drop.
 */
export type RelationDrawn = Event<
  'RelationDrawn',
  { entityId: string; fromId: string; toId: string }
>;

export type RelationRemoved = Event<'RelationRemoved', { entityId: string }>;

export type RelationEvent = RelationDrawn | RelationRemoved;
