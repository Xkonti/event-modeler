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
  | 'relation'
  | 'user'
  | 'account';

export const streamId = (type: EntityType, id: string): string => `${type}-${id}`;

export const businessFactStreamId = (id: string): string =>
  streamId('businessFact', id);

/** One stream per auth user: `user-{userId}` (userId = better-auth's generated id). */
export const userStreamId = (id: string): string => streamId('user', id);

/**
 * One stream per auth account row: `account-{accountId}` where accountId =
 * better-auth's `account.id` (its row PK), NOT the provider-side `accountId`.
 * Keyed on the PK so every `where:[{field:'id'}]` is a direct stream lookup.
 */
export const accountStreamId = (id: string): string => streamId('account', id);
