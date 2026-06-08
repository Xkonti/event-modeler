import { pongoMultiStreamProjection } from '@event-driven-io/emmett-postgresql';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { BusinessFactEvent } from '../domain/businessFact/events.ts';
import type { CommandEvent } from '../domain/command/events.ts';
import type {
  SliceDefined,
  SliceRenamed,
  SliceArchived,
} from '../domain/slice/events.ts';
import type { EntityType } from '../shared/streams.ts';

/**
 * READ MODEL (not a constraint) — the entity catalog the UI queries. A Pongo
 * (JSONB) document per entity, built from the GLOBAL ordered event log across
 * all streams. Run ASYNC via a consumer (src/consumers.ts) → eventually
 * consistent, freely rebuildable, never on the write path.
 *
 * Generic across entity types: every entity's `*Defined/*Renamed/*Archived` event
 * carries `entityId`, so one projection + one `getDocumentId` serves them all.
 * Only lifecycle events are cataloged — a slice's placement events are NOT here
 * (they project into `slice_placements`).
 *
 * Litmus: if this were 5 minutes stale, no command would *wrongly succeed* —
 * only a query would read stale data. That is what makes it a read model.
 * See notes/constraint-inline-projection-pattern.md.
 */
export type CatalogEntry = {
  _id: string;
  entityType: EntityType;
  name: string;
  context?: string;
  archived: boolean;
};

/** The lifecycle events the catalog folds (not placement/relation events). */
export type CatalogEvent =
  | BusinessFactEvent
  | CommandEvent
  | SliceDefined
  | SliceRenamed
  | SliceArchived;

/** Pure fold — exported for unit testing without a database. */
export const evolveCatalog = (
  document: CatalogEntry | null,
  event: ReadEvent<CatalogEvent>,
): CatalogEntry | null => {
  switch (event.type) {
    case 'BusinessFactDefined': {
      const { entityId, name, context } = event.data;
      return {
        _id: entityId,
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
    case 'CommandDefined': {
      const { entityId, name, context } = event.data;
      return {
        _id: entityId,
        entityType: 'command',
        name,
        context,
        archived: false,
      };
    }
    case 'CommandRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'CommandArchived':
      return document ? { ...document, archived: true } : null;
    case 'SliceDefined':
      return {
        _id: event.data.entityId,
        entityType: 'slice',
        name: event.data.name ?? '',
        archived: false,
      };
    case 'SliceRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'SliceArchived':
      return document ? { ...document, archived: true } : null;
    default:
      return document;
  }
};

export const entityCatalogProjection = pongoMultiStreamProjection<
  CatalogEntry,
  CatalogEvent
>({
  collectionName: 'entity_catalog',
  canHandle: [
    'BusinessFactDefined',
    'BusinessFactRenamed',
    'BusinessFactArchived',
    'CommandDefined',
    'CommandRenamed',
    'CommandArchived',
    'SliceDefined',
    'SliceRenamed',
    'SliceArchived',
  ],
  getDocumentId: (event) => event.data.entityId,
  evolve: evolveCatalog,
});
