import type { Event } from '@event-driven-io/emmett';
import type { FieldDef } from '../../shared/fields.ts';

/**
 * Read-model entity events. One stream per read model: `readModel-{entityId}`.
 * Every event carries `modelId` (F1). "Read model" here is the MODEL element
 * (the green sticky — structured data pulled out of the modeled system),
 * distinct from this app's own read models. Deletion is an event (`Archived`),
 * never a row drop.
 *
 * Read models are LANE-AGNOSTIC (only facts get a Context). They hold their own
 * `fields` schema (decision #1/#7), edited via `ReadModelFieldsUpdated` (F5).
 *
 * `mode` (F7, es-book ch 30/31): `projected` = built from feeding facts (the
 * default; absent on pre-F7 events ⇒ projected), `live` = assembled on demand
 * from other read models / current state — the A3 completeness check skips
 * `readmodel-without-source` for live read models. Descriptive, not guarded.
 */
export type ReadModelMode = 'projected' | 'live';

export type ReadModelDefined = Event<
  'ReadModelDefined',
  { modelId: string; entityId: string; name: string; fields: FieldDef[]; mode?: ReadModelMode }
>;

export type ReadModelRenamed = Event<
  'ReadModelRenamed',
  { modelId: string; entityId: string; name: string }
>;

export type ReadModelFieldsUpdated = Event<
  'ReadModelFieldsUpdated',
  { modelId: string; entityId: string; fields: FieldDef[]; mode?: ReadModelMode }
>;

export type ReadModelArchived = Event<
  'ReadModelArchived',
  { modelId: string; entityId: string }
>;

export type ReadModelEvent =
  | ReadModelDefined
  | ReadModelRenamed
  | ReadModelFieldsUpdated
  | ReadModelArchived;
