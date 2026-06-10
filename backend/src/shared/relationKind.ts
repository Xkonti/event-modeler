import type { EntityType } from './streams.ts';

/**
 * The 11 directed valid relation type-pairs (F4; spec/em-brainstorm-results.md
 * "Relation pair table (extended for Translation)") + the kind each denotes.
 * The relation KIND is STORED on `RelationDrawn` (F4) — the 4th pattern
 * (translation / external facts) makes pure type-pair derivation ambiguous as
 * the model grows, and `meta` layers need a stable discriminator. This table is
 * the ALLOW-LIST the API validates a submitted kind against; today every pair
 * still maps to exactly one kind.
 */
/** The closed set of relation kinds — a literal union so kind-matching code is compiler-checked. */
export type RelationKind =
  | 'displayedBy'
  | 'monitoredBy'
  | 'issues'
  | 'reacts'
  | 'produces'
  | 'feeds'
  | 'inbound'
  | 'triggers'
  | 'directTranslation'
  | 'outbound'
  | 'publishes';

export const VALID_PAIRS: ReadonlyArray<
  readonly [EntityType, EntityType, RelationKind]
> = [
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
];

/** Is `from → to` an allowed (directed) relation? */
export const isValidPair = (from: EntityType, to: EntityType): boolean =>
  VALID_PAIRS.some(([f, t]) => f === from && t === to);

/** The kind the allow-list assigns to `from → to`, or null if the pair is invalid. */
export const kindForPair = (from: EntityType, to: EntityType): RelationKind | null => {
  const pair = VALID_PAIRS.find(([f, t]) => f === from && t === to);
  return pair ? pair[2] : null;
};
