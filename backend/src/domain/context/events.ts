import type { Event } from '@event-driven-io/emmett';

/**
 * Context (swimlane) entity events. One stream per context: `context-{contextId}`.
 * A context is a user-named lane that business facts (internal + external) get
 * assigned to; it is NOT a catalog entity — it lives in its own namespace
 * (`context_names`, separate from `entity_names`; G-C2) and its own read model
 * (`contexts`). Archiving a context leaves assigned facts pointing at it
 * (dangling allowed; render falls back to "archived lane" — X1 lean).
 */
export type ContextDefined = Event<
  'ContextDefined',
  { modelId: string; contextId: string; name: string }
>;

export type ContextRenamed = Event<
  'ContextRenamed',
  { modelId: string; contextId: string; name: string }
>;

export type ContextArchived = Event<
  'ContextArchived',
  { modelId: string; contextId: string }
>;

export type ContextEvent = ContextDefined | ContextRenamed | ContextArchived;
