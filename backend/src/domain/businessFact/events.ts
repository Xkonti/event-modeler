import type { Event } from '@event-driven-io/emmett';
import type { FieldDef } from '../../shared/fields.ts';

export type { FieldDef };

/**
 * Business-fact entity events. One stream per fact: `businessFact-{entityId}`.
 * `name` is the human-facing handle; `entityId` is the stable identity. Every
 * event carries `modelId` (F1) — the model the fact belongs to. Deletion is an
 * event (`Archived`), never a row drop.
 *
 * NO `context` (F2): a fact is lane-less at definition; its lane (Context) is
 * assigned later via a separate fact (Flow 2 / chunk X1). `fields` hold the
 * fact's own schema (decision #1/#7); `fieldType` is free-form text (O4).
 */
export type BusinessFactDefined = Event<
  'BusinessFactDefined',
  { modelId: string; entityId: string; name: string; fields: FieldDef[] }
>;

export type BusinessFactRenamed = Event<
  'BusinessFactRenamed',
  { modelId: string; entityId: string; name: string }
>;

export type BusinessFactFieldsUpdated = Event<
  'BusinessFactFieldsUpdated',
  { modelId: string; entityId: string; fields: FieldDef[] }
>;

export type BusinessFactArchived = Event<
  'BusinessFactArchived',
  { modelId: string; entityId: string }
>;

/**
 * Lane assignment (X1, Flow 2). Lives on the FACT's stream — the lane is a
 * property of the fact, last-write-wins on re-assign (E1). `previousContextId`
 * is stamped from state so consumers that track per-lane membership can see the
 * lane being vacated without replaying the whole stream.
 */
export type BusinessFactAssignedToContext = Event<
  'BusinessFactAssignedToContext',
  {
    modelId: string;
    entityId: string;
    contextId: string;
    previousContextId?: string;
  }
>;

export type BusinessFactContextCleared = Event<
  'BusinessFactContextCleared',
  { modelId: string; entityId: string; contextId: string }
>;

export type BusinessFactEvent =
  | BusinessFactDefined
  | BusinessFactRenamed
  | BusinessFactFieldsUpdated
  | BusinessFactAssignedToContext
  | BusinessFactContextCleared
  | BusinessFactArchived;
