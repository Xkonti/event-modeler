import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { AutomationEvent, TriggerConfig } from './events.ts';
import { isBlank } from '../../shared/fields.ts';

/**
 * Decider for a single automation stream. Within-stream invariants: define-once,
 * non-blank name, well-formed triggerConfig, edit-only-while-active.
 * Reconfigure is full-replace (G3) — the new triggerConfig is authoritative.
 * Cross-stream ref validity (monitored read model / issued command exist, right
 * type, same model) is the API edge's catalog pre-check, not here.
 *
 * `modelId` is set at Define and immutable; mutations carry only `entityId` and
 * the decider stamps `state.modelId` onto each event (F1).
 */

// --- State ---------------------------------------------------------------

export type Automation =
  | { status: 'empty' }
  | {
      status: 'active';
      modelId: string;
      entityId: string;
      name: string;
      triggerConfig: TriggerConfig;
    }
  | { status: 'archived'; modelId: string; entityId: string };

export const initialState = (): Automation => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineAutomation = Command<
  'DefineAutomation',
  { modelId: string; entityId: string; name: string; triggerConfig: TriggerConfig }
>;
export type RenameAutomation = Command<
  'RenameAutomation',
  { entityId: string; name: string }
>;
export type ReconfigureAutomation = Command<
  'ReconfigureAutomation',
  { entityId: string; triggerConfig: TriggerConfig }
>;
export type ArchiveAutomation = Command<'ArchiveAutomation', { entityId: string }>;

export type AutomationCommand =
  | DefineAutomation
  | RenameAutomation
  | ReconfigureAutomation
  | ArchiveAutomation;

const TRIGGER_TYPES = ['fact', 'timer', 'interaction'] as const;

const assertValidTriggerConfig = (config: TriggerConfig): void => {
  if (!TRIGGER_TYPES.includes(config.triggerType))
    throw new IllegalStateError(
      `Trigger type must be one of: ${TRIGGER_TYPES.join(', ')}`,
    );
};

// --- Decide --------------------------------------------------------------

export const decide = (
  command: AutomationCommand,
  state: Automation,
): AutomationEvent => {
  switch (command.type) {
    case 'DefineAutomation': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Automation already defined');
      const { modelId, entityId, name, triggerConfig } = command.data;
      if (isBlank(name))
        throw new IllegalStateError('Automation name must not be blank');
      assertValidTriggerConfig(triggerConfig);
      return {
        type: 'AutomationDefined',
        data: { modelId, entityId, name, triggerConfig },
      };
    }
    case 'RenameAutomation': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active automation');
      if (isBlank(command.data.name))
        throw new IllegalStateError('Automation name must not be blank');
      return {
        type: 'AutomationRenamed',
        data: { modelId: state.modelId, entityId: state.entityId, name: command.data.name },
      };
    }
    case 'ReconfigureAutomation': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only reconfigure an active automation');
      assertValidTriggerConfig(command.data.triggerConfig);
      // Full-replace semantics — the new config is authoritative (G3).
      return {
        type: 'AutomationReconfigured',
        data: {
          modelId: state.modelId,
          entityId: state.entityId,
          triggerConfig: command.data.triggerConfig,
        },
      };
    }
    case 'ArchiveAutomation': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active automation');
      return {
        type: 'AutomationArchived',
        data: { modelId: state.modelId, entityId: state.entityId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: Automation, event: AutomationEvent): Automation => {
  switch (event.type) {
    case 'AutomationDefined': {
      const { modelId, entityId, name, triggerConfig } = event.data;
      return { status: 'active', modelId, entityId, name, triggerConfig };
    }
    case 'AutomationRenamed':
      return state.status === 'active' ? { ...state, name: event.data.name } : state;
    case 'AutomationReconfigured':
      return state.status === 'active'
        ? { ...state, triggerConfig: event.data.triggerConfig }
        : state;
    case 'AutomationArchived':
      return { status: 'archived', modelId: event.data.modelId, entityId: event.data.entityId };
  }
};
