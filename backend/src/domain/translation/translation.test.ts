import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './translation.ts';
import type { Mapping } from './events.ts';

/**
 * Unit tests for the translation decider — within-stream invariants (define-once,
 * non-blank name, valid direction, no blank pair fields, full-replace mapping,
 * archive terminal).
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const M = 'm-budget';
const mapping: Mapping = {
  direction: 'inbound',
  pairs: [{ externalField: 'sku', internalField: 'productId' }],
};
const defined = {
  type: 'TranslationDefined' as const,
  data: { modelId: M, entityId: 't1', name: 'Catalog Import', mapping },
};
const archived = {
  type: 'TranslationArchived' as const,
  data: { modelId: M, entityId: 't1' },
};

describe('translation decider', () => {
  it('defines a translation with a mapping', () => {
    given([])
      .when({ type: 'DefineTranslation', data: defined.data })
      .then([defined]);
  });

  it('rejects a blank name on define (G-C1)', () => {
    given([])
      .when({
        type: 'DefineTranslation',
        data: { modelId: M, entityId: 't1', name: '', mapping },
      })
      .thenThrows();
  });

  it('rejects an unknown direction', () => {
    given([])
      .when({
        type: 'DefineTranslation',
        data: {
          modelId: M,
          entityId: 't1',
          name: 'X',
          mapping: { direction: 'sideways' as never, pairs: [] },
        },
      })
      .thenThrows();
  });

  it('rejects blank mapping pair fields', () => {
    given([])
      .when({
        type: 'DefineTranslation',
        data: {
          modelId: M,
          entityId: 't1',
          name: 'X',
          mapping: {
            direction: 'outbound',
            pairs: [{ externalField: ' ', internalField: 'a' }],
          },
        },
      })
      .thenThrows();
  });

  it('allows an empty pair list (mapping detailed later)', () => {
    given([])
      .when({
        type: 'DefineTranslation',
        data: {
          modelId: M,
          entityId: 't1',
          name: 'X',
          mapping: { direction: 'outbound', pairs: [] },
        },
      })
      .then([
        {
          type: 'TranslationDefined',
          data: {
            modelId: M,
            entityId: 't1',
            name: 'X',
            mapping: { direction: 'outbound', pairs: [] },
          },
        },
      ]);
  });

  it('updates the mapping with full-replace semantics (G3, modelId stamped)', () => {
    const next: Mapping = {
      direction: 'outbound',
      pairs: [{ externalField: 'total', internalField: 'amount' }],
    };
    given([defined])
      .when({ type: 'UpdateTranslationMapping', data: { entityId: 't1', mapping: next } })
      .then([
        {
          type: 'TranslationMappingUpdated',
          data: { modelId: M, entityId: 't1', mapping: next },
        },
      ]);
  });

  it('archives an active translation', () => {
    given([defined])
      .when({ type: 'ArchiveTranslation', data: { entityId: 't1' } })
      .then([archived]);
  });

  it('rejects updating the mapping of an archived translation (G-C5)', () => {
    given([defined, archived])
      .when({ type: 'UpdateTranslationMapping', data: { entityId: 't1', mapping } })
      .thenThrows();
  });
});
