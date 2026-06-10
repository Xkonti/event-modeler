/**
 * Stream-id construction. One stream per entity (see
 * notes/event-sourcing-architecture.md). The type prefix makes any reference a
 * direct, indexed point-lookup — `businessFact-{id}` resolves without scanning.
 *
 * A "stream" is just a `stream_id` value in the single `emt_messages` table,
 * never its own table.
 */
export type EntityType =
  | 'model'
  | 'businessFact'
  | 'externalBusinessFact'
  | 'command'
  | 'readModel'
  | 'wireframe'
  | 'automation'
  | 'translation'
  | 'context'
  | 'slice'
  | 'relation'
  | 'scenario'
  | 'user'
  | 'account';

export const streamId = (type: EntityType, id: string): string => `${type}-${id}`;

/** One stream per model (the root container): `model-{modelId}`. */
export const modelStreamId = (id: string): string => streamId('model', id);

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

/** One stream per slice: `slice-{entityId}` (holds the slice's placements). */
export const sliceStreamId = (id: string): string => streamId('slice', id);

/** One stream per command entity: `command-{entityId}`. */
export const commandStreamId = (id: string): string => streamId('command', id);

/** One stream per read-model entity: `readModel-{entityId}`. */
export const readModelStreamId = (id: string): string => streamId('readModel', id);

/** One stream per wireframe entity: `wireframe-{entityId}`. */
export const wireframeStreamId = (id: string): string => streamId('wireframe', id);

/** One stream per external business fact: `externalBusinessFact-{entityId}`. */
export const externalBusinessFactStreamId = (id: string): string =>
  streamId('externalBusinessFact', id);

/** One stream per relation: `relation-{relationId}` (references both endpoints). */
export const relationStreamId = (id: string): string => streamId('relation', id);

/** One stream per automation entity: `automation-{entityId}`. */
export const automationStreamId = (id: string): string => streamId('automation', id);

/** One stream per translation entity: `translation-{entityId}`. */
export const translationStreamId = (id: string): string => streamId('translation', id);

/** One stream per context (swimlane): `context-{contextId}`. */
export const contextStreamId = (id: string): string => streamId('context', id);

/** One stream per scenario (GWT/GT rule): `scenario-{scenarioId}`. */
export const scenarioStreamId = (id: string): string => streamId('scenario', id);
