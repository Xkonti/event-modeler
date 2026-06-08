import type { EntityType } from './streams.ts';

/**
 * The 6 directed valid relation type-pairs (notes/core-flow.md,
 * notes/model-structure.md) + the kind each denotes. The relation KIND is derived
 * from the ordered endpoint type-pair, never stored on the event — a later
 * discriminator is added (clean-additive) only when Translation / External Events
 * make a pair ambiguous. The list is DATA so the 4th pattern can extend it.
 */
export const VALID_PAIRS: ReadonlyArray<readonly [EntityType, EntityType, string]> =
  [
    ['readModel', 'wireframe', 'displayedBy'],
    ['readModel', 'automation', 'monitoredBy'],
    ['wireframe', 'command', 'issues'],
    ['automation', 'command', 'reacts'],
    ['command', 'businessFact', 'produces'],
    ['businessFact', 'readModel', 'feeds'],
  ];

/** Is `from → to` an allowed (directed) relation? */
export const isValidPair = (from: EntityType, to: EntityType): boolean =>
  VALID_PAIRS.some(([f, t]) => f === from && t === to);

/** Relation kind for `from → to`, or null if the pair is not valid. */
export const deriveKind = (from: EntityType, to: EntityType): string | null => {
  const pair = VALID_PAIRS.find(([f, t]) => f === from && t === to);
  return pair ? pair[2] : null;
};
