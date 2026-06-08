import type { Event } from '@event-driven-io/emmett';

/**
 * Command entity events. One stream per command: `command-{entityId}`. Same shape
 * as a business fact (name + context, globally unique name). "Command" here is the
 * MODEL element (a request to change the system), distinct from Emmett's `Command`
 * envelope type. Deletion is an event (`Archived`), never a row drop.
 */
export type CommandDefined = Event<
  'CommandDefined',
  { entityId: string; name: string; context: string }
>;

export type CommandRenamed = Event<
  'CommandRenamed',
  { entityId: string; name: string }
>;

export type CommandArchived = Event<'CommandArchived', { entityId: string }>;

export type CommandEvent =
  | CommandDefined
  | CommandRenamed
  | CommandArchived;
