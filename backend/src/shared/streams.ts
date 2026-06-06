/**
 * Stream-id construction. One stream per entity (see
 * notes/event-sourcing-architecture.md). The type prefix makes any reference a
 * direct, indexed point-lookup — `businessFact-{id}` resolves without scanning.
 *
 * A "stream" is just a `stream_id` value in the single `emt_messages` table,
 * never its own table.
 */
export type EntityType =
  | 'businessFact'
  | 'command'
  | 'readModel'
  | 'wireframe'
  | 'automation'
  | 'slice'
  | 'relation';

export const streamId = (type: EntityType, id: string): string => `${type}-${id}`;

export const businessFactStreamId = (id: string): string =>
  streamId('businessFact', id);
