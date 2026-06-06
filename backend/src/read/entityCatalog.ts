import { pongoMultiStreamProjection } from '@event-driven-io/emmett-postgresql';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { BusinessFactEvent } from '../domain/businessFact/events.ts';

/**
 * READ MODEL (not a constraint) — the entity catalog the UI queries. A Pongo
 * (JSONB) document per entity, built from the GLOBAL ordered event log across
 * all streams. Run ASYNC via a consumer (src/consumers.ts) → eventually
 * consistent, freely rebuildable, never on the write path.
 *
 * Litmus: if this were 5 minutes stale, no command would *wrongly succeed* —
 * only a query would read stale data. That is what makes it a read model.
 * See notes/constraint-inline-projection-pattern.md.
 */
export type CatalogEntry = {
  _id: string;
  entityType: 'businessFact';
  name: string;
  context: string;
  archived: boolean;
};

/** Pure fold — exported for unit testing without a database. */
export const evolveCatalog = (
  document: CatalogEntry | null,
  event: ReadEvent<BusinessFactEvent>,
): CatalogEntry | null => {
  switch (event.type) {
    case 'BusinessFactDefined': {
      const { factId, name, context } = event.data;
      return {
        _id: factId,
        entityType: 'businessFact',
        name,
        context,
        archived: false,
      };
    }
    case 'BusinessFactRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'BusinessFactArchived':
      return document ? { ...document, archived: true } : null;
    default:
      return document;
  }
};

export const entityCatalogProjection = pongoMultiStreamProjection<
  CatalogEntry,
  BusinessFactEvent
>({
  collectionName: 'entity_catalog',
  canHandle: [
    'BusinessFactDefined',
    'BusinessFactRenamed',
    'BusinessFactArchived',
  ],
  getDocumentId: (event) => event.data.factId,
  evolve: evolveCatalog,
});
