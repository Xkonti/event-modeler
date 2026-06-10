// MIRROR — source of truth is backend/src/shared/slotRoles.ts; update BOTH.
// The snap-slot placement model (F3): a placed entity lands in a ROLE BAND
// computed from its type — never authored. Within a band, MULTI-cardinality
// types are ordered by integer `slot` (0 = top); SINGLE-cardinality types
// (command / automation / translation) carry no slot and allow at most one
// placement per slice. The frontend uses this for the place-entity picker
// (which types fit a clicked ghost slot) and the canvas solver.

const ROLE_BY_TYPE = {
  wireframe: 'trigger',
  automation: 'trigger',
  translation: 'trigger',
  command: 'command',
  readModel: 'readModel',
  businessFact: 'fact',
  externalBusinessFact: 'fact',
}

/**
 * The band an entity type snaps into, or null if the type is not placeable.
 * @param {string} type entity type
 * @returns {'trigger'|'command'|'readModel'|'fact'|null}
 */
export function slotRoleFor(type) {
  return ROLE_BY_TYPE[type] ?? null
}

/**
 * Types limited to ONE placement per slice (placed without a slot).
 * @param {string} type entity type
 */
export function isSingleCardinality(type) {
  return type === 'command' || type === 'automation' || type === 'translation'
}

/** Every placeable entity type (palette + place-picker enumeration). */
export const PLACEABLE_TYPES = Object.keys(ROLE_BY_TYPE)
