import type { Event } from '@event-driven-io/emmett';
import type { FieldDef } from '../../shared/fields.ts';

/**
 * External-business-fact entity events. One stream per external fact:
 * `externalBusinessFact-{entityId}`. Every event carries `modelId` (F1). The
 * yellow element — data arriving from / published to another system, a
 * tech-agnostic integration record. Same lifecycle + `fields` schema as an
 * internal fact; only the RENDERING differs (yellow — a frontend concern).
 *
 * Lane-less at definition like internal facts: external facts are assigned a
 * Context EXPLICITLY via the same assign path (O5), arriving with chunk X1 —
 * never auto-assigned at define. Deletion is an event (`Archived`).
 */
export type ExternalBusinessFactDefined = Event<
  'ExternalBusinessFactDefined',
  { modelId: string; entityId: string; name: string; fields: FieldDef[] }
>;

export type ExternalBusinessFactRenamed = Event<
  'ExternalBusinessFactRenamed',
  { modelId: string; entityId: string; name: string }
>;

export type ExternalBusinessFactFieldsUpdated = Event<
  'ExternalBusinessFactFieldsUpdated',
  { modelId: string; entityId: string; fields: FieldDef[] }
>;

export type ExternalBusinessFactArchived = Event<
  'ExternalBusinessFactArchived',
  { modelId: string; entityId: string }
>;

/**
 * Lane assignment (X1, Flow 2; same path as internal facts — O5). Lives on the
 * fact's stream; last-write-wins on re-assign (E1). `previousContextId` is
 * stamped from state so per-lane consumers see the lane being vacated.
 */
export type ExternalBusinessFactAssignedToContext = Event<
  'ExternalBusinessFactAssignedToContext',
  {
    modelId: string;
    entityId: string;
    contextId: string;
    previousContextId?: string;
  }
>;

export type ExternalBusinessFactContextCleared = Event<
  'ExternalBusinessFactContextCleared',
  { modelId: string; entityId: string; contextId: string }
>;

export type ExternalBusinessFactEvent =
  | ExternalBusinessFactDefined
  | ExternalBusinessFactRenamed
  | ExternalBusinessFactFieldsUpdated
  | ExternalBusinessFactAssignedToContext
  | ExternalBusinessFactContextCleared
  | ExternalBusinessFactArchived;
