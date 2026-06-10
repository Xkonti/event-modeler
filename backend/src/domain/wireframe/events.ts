import type { Event } from '@event-driven-io/emmett';

/**
 * Wireframe entity events. One stream per wireframe: `wireframe-{entityId}`.
 * Every event carries `modelId` (F1). A wireframe is a rough UI mockup — about
 * DATA, not UX polish. Its payload is `content` (layout/text), not `fields`;
 * edited via `WireframeContentUpdated` (the FieldsUpdated analog). Deletion is
 * an event (`Archived`), never a row drop. Lane-agnostic.
 */
export type WireframeDefined = Event<
  'WireframeDefined',
  { modelId: string; entityId: string; name: string; content: string }
>;

export type WireframeRenamed = Event<
  'WireframeRenamed',
  { modelId: string; entityId: string; name: string }
>;

export type WireframeContentUpdated = Event<
  'WireframeContentUpdated',
  { modelId: string; entityId: string; content: string }
>;

export type WireframeArchived = Event<
  'WireframeArchived',
  { modelId: string; entityId: string }
>;

export type WireframeEvent =
  | WireframeDefined
  | WireframeRenamed
  | WireframeContentUpdated
  | WireframeArchived;
