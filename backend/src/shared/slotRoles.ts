import type { EntityType } from './streams.ts';

/**
 * The snap-slot placement model (F3). A placed entity lands in a ROLE BAND
 * computed from its type — never authored: triggers on top, then commands, read
 * models, facts (em-scenarios Flow 3). Within a band, MULTI-cardinality types
 * are ordered by an integer `slot` (0 = top); SINGLE-cardinality types
 * (command / automation / translation — at most ONE of each per slice) carry no
 * slot. Free x/y does not exist; reordering is `SwapEntitySlots`.
 */
export type SlotRole = 'trigger' | 'command' | 'readModel' | 'fact';

const ROLE_BY_TYPE: Partial<Record<EntityType, SlotRole>> = {
  wireframe: 'trigger',
  automation: 'trigger',
  translation: 'trigger',
  command: 'command',
  readModel: 'readModel',
  businessFact: 'fact',
  externalBusinessFact: 'fact',
};

/** The band an entity type snaps into, or null if the type is not placeable. */
export const slotRoleFor = (type: EntityType): SlotRole | null =>
  ROLE_BY_TYPE[type] ?? null;

/** Types limited to ONE placement per slice (placed without a slot). */
export const isSingleCardinality = (type: EntityType): boolean =>
  type === 'command' || type === 'automation' || type === 'translation';
