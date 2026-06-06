/**
 * Name normalization for the global-uniqueness key.
 *
 * The displayed name lives on the entity's own event (domain-correct); this
 * derives the key the `entity_names` constraint table enforces uniqueness on.
 * Context-prefixed names (e.g. `Payments_OrderCreated`) feed straight in.
 */
export const normalizeName = (name: string): string =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();
