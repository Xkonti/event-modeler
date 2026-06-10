import type { Event } from '@event-driven-io/emmett';

/**
 * Automation entity events. One stream per automation: `automation-{entityId}`.
 * The divergent (≈30%) catalog type: instead of a `fields` schema it carries a
 * `triggerConfig` — what kicks the background process off (a fact, a timer, or a
 * user interaction), which read model it monitors, and which command it issues
 * (em-automations anatomy). Edits go through `ReconfigureAutomation` (G3) — no
 * generic FieldsUpdated. Every event carries `modelId` (F1).
 *
 * The referenced read model / command are SOFT references by id — validated at
 * the API edge against the catalog, never re-checked on replay.
 */
export type TriggerType = 'fact' | 'timer' | 'interaction';

export type TriggerConfig = {
  triggerType: TriggerType;
  monitoredReadModelId?: string;
  issuedCommandId?: string;
};

export type AutomationDefined = Event<
  'AutomationDefined',
  { modelId: string; entityId: string; name: string; triggerConfig: TriggerConfig }
>;

export type AutomationRenamed = Event<
  'AutomationRenamed',
  { modelId: string; entityId: string; name: string }
>;

export type AutomationReconfigured = Event<
  'AutomationReconfigured',
  { modelId: string; entityId: string; triggerConfig: TriggerConfig }
>;

export type AutomationArchived = Event<
  'AutomationArchived',
  { modelId: string; entityId: string }
>;

export type AutomationEvent =
  | AutomationDefined
  | AutomationRenamed
  | AutomationReconfigured
  | AutomationArchived;
