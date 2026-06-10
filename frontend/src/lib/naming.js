// MIRROR — source of truth is backend/src/shared/naming.ts; update BOTH.
// The normalization the `entity_names` uniqueness constraint keys on. The
// frontend uses it for the dup-name 409 flow: look up the colliding catalog
// entry by normalized name to offer "use existing instead?".

/**
 * @param {string} name
 * @returns {string} trim → collapse whitespace → lowercase
 */
export function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}
