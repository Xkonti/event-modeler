import type { Event } from '@event-driven-io/emmett';

/**
 * Model (root container) events. One stream per model: `model-{modelId}`.
 * Every other entity in the system carries this `modelId` (F1) — the model is
 * the aggregate boundary everything is scoped by. Deletion is an event
 * (`Archived`), never a row drop.
 *
 * `modelId` lives in the PAYLOAD (business data — it scopes queries +
 * uniqueness), not in metadata. Metadata (correlation/causation/userId) is a
 * separate, deferred concern (es-book ch.39).
 */
export type ModelCreated = Event<'ModelCreated', { modelId: string; name: string }>;

export type ModelRenamed = Event<'ModelRenamed', { modelId: string; name: string }>;

export type ModelArchived = Event<'ModelArchived', { modelId: string }>;

export type ModelEvent = ModelCreated | ModelRenamed | ModelArchived;
