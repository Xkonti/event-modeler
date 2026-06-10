// MIRROR — source of truth is backend/src/shared/relationKind.ts; update BOTH.
// The 11 directed valid relation type-pairs (F4) + the kind each denotes. The
// kind is STORED on the relation (the 4th pattern makes pure type-pair
// derivation ambiguous), so the W7 picker offers the valid kinds for a pair and
// submits the chosen one; the backend validates against the same allow-list
// (422 on mismatch). Today every pair still maps to exactly one kind — the
// picker arrives preselected.

export const VALID_PAIRS = [
  ['readModel', 'wireframe', 'displayedBy'],
  ['readModel', 'automation', 'monitoredBy'],
  ['wireframe', 'command', 'issues'],
  ['automation', 'command', 'reacts'],
  ['command', 'businessFact', 'produces'],
  ['businessFact', 'readModel', 'feeds'],
  // 4th pattern (G1 resolved: outbound target is an externalBusinessFact).
  ['externalBusinessFact', 'translation', 'inbound'],
  ['translation', 'command', 'triggers'],
  ['externalBusinessFact', 'readModel', 'directTranslation'],
  ['businessFact', 'translation', 'outbound'],
  ['translation', 'externalBusinessFact', 'publishes'],
]

/**
 * Every kind the allow-list permits for `from → to` (dropdown-ready; today the
 * array has 0 or 1 entries).
 * @param {string} from entity type
 * @param {string} to entity type
 * @returns {string[]}
 */
export function validKindsForPair(from, to) {
  return VALID_PAIRS.filter(([f, t]) => f === from && t === to).map(([, , k]) => k)
}

/**
 * Is `from → to` an allowed (directed) relation?
 * @param {string} from @param {string} to
 */
export function isValidPair(from, to) {
  return validKindsForPair(from, to).length > 0
}
