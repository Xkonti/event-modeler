import type { Event } from '@event-driven-io/emmett';

/**
 * Business-fact entity events. One stream per fact: `businessFact-{entityId}`.
 * `name` is the human-facing handle; `entityId` is the stable identity
 * (notes/model-structure.md). Deletion is an event (`Archived`), never a row drop.
 */
export type BusinessFactDefined = Event<
  'BusinessFactDefined',
  { entityId: string; name: string; context: string }
>;

export type BusinessFactRenamed = Event<
  'BusinessFactRenamed',
  { entityId: string; name: string }
>;

export type BusinessFactArchived = Event<
  'BusinessFactArchived',
  { entityId: string }
>;

export type BusinessFactEvent =
  | BusinessFactDefined
  | BusinessFactRenamed
  | BusinessFactArchived;
