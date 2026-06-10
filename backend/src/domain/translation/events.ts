import type { Event } from '@event-driven-io/emmett';

/**
 * Translation entity events. One stream per translation: `translation-{entityId}`.
 * The second divergent catalog type: instead of a `fields` schema it carries a
 * `mapping` — the direction of the anti-corruption layer (inbound: external fact
 * → internal command; outbound: internal fact → external fact) and the
 * field-to-field pairs (em-automations, 4th pattern). Edits go through
 * `UpdateTranslationMapping` (G3). Every event carries `modelId` (F1).
 */
export type MappingDirection = 'inbound' | 'outbound';

export type MappingPair = { externalField: string; internalField: string };

export type Mapping = {
  direction: MappingDirection;
  pairs: MappingPair[];
};

export type TranslationDefined = Event<
  'TranslationDefined',
  { modelId: string; entityId: string; name: string; mapping: Mapping }
>;

export type TranslationRenamed = Event<
  'TranslationRenamed',
  { modelId: string; entityId: string; name: string }
>;

export type TranslationMappingUpdated = Event<
  'TranslationMappingUpdated',
  { modelId: string; entityId: string; mapping: Mapping }
>;

export type TranslationArchived = Event<
  'TranslationArchived',
  { modelId: string; entityId: string }
>;

export type TranslationEvent =
  | TranslationDefined
  | TranslationRenamed
  | TranslationMappingUpdated
  | TranslationArchived;
