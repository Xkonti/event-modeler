import type { Event } from '@event-driven-io/emmett';

/**
 * Business-fact entity events. One stream per fact: `businessFact-{factId}`.
 * `name` is the human-facing handle; `factId` is the stable identity
 * (notes/model-structure.md). Deletion is an event (`Archived`), never a row drop.
 */
export type BusinessFactDefined = Event<
  'BusinessFactDefined',
  { factId: string; name: string; context: string }
>;

export type BusinessFactRenamed = Event<
  'BusinessFactRenamed',
  { factId: string; name: string }
>;

export type BusinessFactArchived = Event<
  'BusinessFactArchived',
  { factId: string }
>;

export type BusinessFactEvent =
  | BusinessFactDefined
  | BusinessFactRenamed
  | BusinessFactArchived;
