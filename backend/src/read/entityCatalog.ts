import { pongoMultiStreamProjection } from '@event-driven-io/emmett-postgresql';
import type { ReadEvent } from '@event-driven-io/emmett';
import type { BusinessFactEvent } from '../domain/businessFact/events.ts';
import type { CommandEvent } from '../domain/command/events.ts';
import type { ReadModelEvent } from '../domain/readModel/events.ts';
import type { WireframeEvent } from '../domain/wireframe/events.ts';
import type { ExternalBusinessFactEvent } from '../domain/externalBusinessFact/events.ts';
import type { AutomationEvent, TriggerConfig } from '../domain/automation/events.ts';
import type { Mapping, TranslationEvent } from '../domain/translation/events.ts';
import type { FieldDef } from '../shared/fields.ts';
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
/**
 * The entity's own payload (F5): `fields` for the schema-bearing types
 * (businessFact, externalBusinessFact, command, readModel), `content` for
 * wireframes, `triggerConfig` for automations, `mapping` for translations.
 */
export type Definition =
  | { fields: FieldDef[] }
  | { content: string }
  | { triggerConfig: TriggerConfig }
  | { mapping: Mapping };

export type CatalogEntry = {
  _id: string;
  modelId?: string; // present on every cataloged type (F1); optional pre-S1 docs only
  entityType: EntityType;
  name: string;
  definition?: Definition;
  /**
   * Assigned lane (X1, F5) — facts (internal + external) only; never set for
   * lane-agnostic types. May dangle on an archived context (render falls back).
   */
  contextId?: string;
  archived: boolean;
};

/** The lifecycle events the catalog folds (not placement/relation events). */
export type CatalogEvent =
  | BusinessFactEvent
  | CommandEvent
  | ReadModelEvent
  | WireframeEvent
  | ExternalBusinessFactEvent
  | AutomationEvent
  | TranslationEvent
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
      const { modelId, entityId, name, fields } = event.data;
      return {
        _id: entityId,
        modelId,
        entityType: 'businessFact',
        name,
        definition: { fields },
        archived: false,
      };
    }
    case 'BusinessFactRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'BusinessFactFieldsUpdated':
      return document ? { ...document, definition: { fields: event.data.fields } } : null;
    case 'BusinessFactAssignedToContext':
      return document ? { ...document, contextId: event.data.contextId } : null;
    case 'BusinessFactContextCleared':
      return document ? { ...document, contextId: undefined } : null;
    case 'BusinessFactArchived':
      return document ? { ...document, archived: true } : null;
    case 'CommandDefined': {
      const { modelId, entityId, name, fields } = event.data;
      return {
        _id: entityId,
        modelId,
        entityType: 'command',
        name,
        definition: { fields },
        archived: false,
      };
    }
    case 'CommandRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'CommandFieldsUpdated':
      return document ? { ...document, definition: { fields: event.data.fields } } : null;
    case 'CommandArchived':
      return document ? { ...document, archived: true } : null;
    case 'ReadModelDefined': {
      const { modelId, entityId, name, fields } = event.data;
      return {
        _id: entityId,
        modelId,
        entityType: 'readModel',
        name,
        definition: { fields },
        archived: false,
      };
    }
    case 'ReadModelRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'ReadModelFieldsUpdated':
      return document ? { ...document, definition: { fields: event.data.fields } } : null;
    case 'ReadModelArchived':
      return document ? { ...document, archived: true } : null;
    case 'WireframeDefined': {
      const { modelId, entityId, name, content } = event.data;
      return {
        _id: entityId,
        modelId,
        entityType: 'wireframe',
        name,
        definition: { content },
        archived: false,
      };
    }
    case 'WireframeRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'WireframeContentUpdated':
      return document ? { ...document, definition: { content: event.data.content } } : null;
    case 'WireframeArchived':
      return document ? { ...document, archived: true } : null;
    case 'ExternalBusinessFactDefined': {
      const { modelId, entityId, name, fields } = event.data;
      return {
        _id: entityId,
        modelId,
        entityType: 'externalBusinessFact',
        name,
        definition: { fields },
        archived: false,
      };
    }
    case 'ExternalBusinessFactRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'ExternalBusinessFactFieldsUpdated':
      return document ? { ...document, definition: { fields: event.data.fields } } : null;
    case 'ExternalBusinessFactAssignedToContext':
      return document ? { ...document, contextId: event.data.contextId } : null;
    case 'ExternalBusinessFactContextCleared':
      return document ? { ...document, contextId: undefined } : null;
    case 'ExternalBusinessFactArchived':
      return document ? { ...document, archived: true } : null;
    case 'AutomationDefined': {
      const { modelId, entityId, name, triggerConfig } = event.data;
      return {
        _id: entityId,
        modelId,
        entityType: 'automation',
        name,
        definition: { triggerConfig },
        archived: false,
      };
    }
    case 'AutomationRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'AutomationReconfigured':
      return document
        ? { ...document, definition: { triggerConfig: event.data.triggerConfig } }
        : null;
    case 'AutomationArchived':
      return document ? { ...document, archived: true } : null;
    case 'TranslationDefined': {
      const { modelId, entityId, name, mapping } = event.data;
      return {
        _id: entityId,
        modelId,
        entityType: 'translation',
        name,
        definition: { mapping },
        archived: false,
      };
    }
    case 'TranslationRenamed':
      return document ? { ...document, name: event.data.name } : null;
    case 'TranslationMappingUpdated':
      return document ? { ...document, definition: { mapping: event.data.mapping } } : null;
    case 'TranslationArchived':
      return document ? { ...document, archived: true } : null;
    case 'SliceDefined':
      return {
        _id: event.data.sliceId,
        modelId: event.data.modelId,
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
    'BusinessFactFieldsUpdated',
    'BusinessFactAssignedToContext',
    'BusinessFactContextCleared',
    'BusinessFactArchived',
    'CommandDefined',
    'CommandRenamed',
    'CommandFieldsUpdated',
    'CommandArchived',
    'ReadModelDefined',
    'ReadModelRenamed',
    'ReadModelFieldsUpdated',
    'ReadModelArchived',
    'WireframeDefined',
    'WireframeRenamed',
    'WireframeContentUpdated',
    'WireframeArchived',
    'ExternalBusinessFactDefined',
    'ExternalBusinessFactRenamed',
    'ExternalBusinessFactFieldsUpdated',
    'ExternalBusinessFactAssignedToContext',
    'ExternalBusinessFactContextCleared',
    'ExternalBusinessFactArchived',
    'AutomationDefined',
    'AutomationRenamed',
    'AutomationReconfigured',
    'AutomationArchived',
    'TranslationDefined',
    'TranslationRenamed',
    'TranslationMappingUpdated',
    'TranslationArchived',
    'SliceDefined',
    'SliceRenamed',
    'SliceArchived',
  ],
  // Slice events key on `sliceId`; every other cataloged event on `entityId`.
  getDocumentId: (event) =>
    'sliceId' in event.data ? event.data.sliceId : event.data.entityId,
  evolve: evolveCatalog,
});
