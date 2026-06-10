import type { Event } from '@event-driven-io/emmett';
import type { FieldDef } from '../../shared/fields.ts';

/**
 * Command entity events. One stream per command: `command-{entityId}`. Every
 * event carries `modelId` (F1). "Command" here is the MODEL element (a request to
 * change the system), distinct from Emmett's `Command` envelope type. Deletion is
 * an event (`Archived`), never a row drop.
 *
 * Commands are LANE-AGNOSTIC — they carry no `context`/lane (F2; only facts get a
 * Context). They hold their own `fields` schema (decision #1/#7), edited via
 * `CommandFieldsUpdated` (F5).
 */
export type CommandDefined = Event<
  'CommandDefined',
  { modelId: string; entityId: string; name: string; fields: FieldDef[] }
>;

export type CommandRenamed = Event<
  'CommandRenamed',
  { modelId: string; entityId: string; name: string }
>;

export type CommandFieldsUpdated = Event<
  'CommandFieldsUpdated',
  { modelId: string; entityId: string; fields: FieldDef[] }
>;

export type CommandArchived = Event<
  'CommandArchived',
  { modelId: string; entityId: string }
>;

export type CommandEvent =
  | CommandDefined
  | CommandRenamed
  | CommandFieldsUpdated
  | CommandArchived;
