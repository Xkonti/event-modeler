import { postgreSQLRawBatchSQLProjection } from '@event-driven-io/emmett-postgresql';
import { sql, type SQL } from '@event-driven-io/dumbo';
import { normalizeName } from '../shared/naming.ts';
import type { BusinessFactEvent } from '../domain/businessFact/events.ts';
import type { CommandEvent } from '../domain/command/events.ts';
import type { ReadModelEvent } from '../domain/readModel/events.ts';
import type { WireframeEvent } from '../domain/wireframe/events.ts';
import type { ExternalBusinessFactEvent } from '../domain/externalBusinessFact/events.ts';
import type { AutomationEvent } from '../domain/automation/events.ts';
import type { TranslationEvent } from '../domain/translation/events.ts';
import type { EntityType } from '../shared/streams.ts';

/**
 * CONSTRAINT projection (not a read model) — enforces PER-MODEL entity-name
 * uniqueness across every NAMED entity type (business facts, commands, read
 * models, wireframes, external facts; G-C2), a cross-aggregate *set* invariant
 * no decider can see. One namespace per model
 * (F1b): the same name is free across different models, but a command can't
 * share a name with a fact in the SAME model.
 *
 * Registered INLINE → these statements run in the SAME transaction as the event
 * append. The `entity_names` `(model_id, normalized_name)` PRIMARY KEY rejects a
 * colliding name: the INSERT throws → the whole append tx rolls back → the
 * command fails.
 *
 * Why a constraint, not a read model: the WRITE PATH depends on it to decide
 * whether the append may commit. See
 * notes/constraint-inline-projection-pattern.md. Relations are NOT here — they
 * carry no name. Slices are NOT here — slice names aren't globally unique in v1.
 *
 * Table is created by src/schema.ts.
 */

/** Free any prior name this entity held, then claim the new one (scoped to its model). */
const claim = (
  modelId: string,
  entityId: string,
  rawName: string,
  entityType: EntityType,
): SQL[] => [
  sql('DELETE FROM entity_names WHERE entity_id = %L', entityId),
  sql(
    `INSERT INTO entity_names (model_id, normalized_name, entity_id, entity_type)
     VALUES (%L, %L, %L, %L)`,
    modelId,
    normalizeName(rawName),
    entityId,
    entityType,
  ),
];

const free = (entityId: string): SQL =>
  sql('DELETE FROM entity_names WHERE entity_id = %L', entityId);

export const entityNamesConstraint = postgreSQLRawBatchSQLProjection<
  | BusinessFactEvent
  | CommandEvent
  | ReadModelEvent
  | WireframeEvent
  | ExternalBusinessFactEvent
  | AutomationEvent
  | TranslationEvent
>({
  name: 'entity_names_constraint',
  canHandle: [
    'AutomationDefined',
    'AutomationRenamed',
    'AutomationArchived',
    'TranslationDefined',
    'TranslationRenamed',
    'TranslationArchived',
    'BusinessFactDefined',
    'BusinessFactRenamed',
    'BusinessFactArchived',
    'CommandDefined',
    'CommandRenamed',
    'CommandArchived',
    'ReadModelDefined',
    'ReadModelRenamed',
    'ReadModelArchived',
    'WireframeDefined',
    'WireframeRenamed',
    'WireframeArchived',
    'ExternalBusinessFactDefined',
    'ExternalBusinessFactRenamed',
    'ExternalBusinessFactArchived',
  ],
  evolve: (events): SQL[] =>
    events.flatMap((event): SQL[] => {
      switch (event.type) {
        case 'BusinessFactDefined':
        case 'BusinessFactRenamed':
          return claim(
            event.data.modelId,
            event.data.entityId,
            event.data.name,
            'businessFact',
          );
        case 'BusinessFactFieldsUpdated':
        case 'BusinessFactAssignedToContext':
        case 'BusinessFactContextCleared':
          return []; // name-neutral (not in canHandle) — present for exhaustiveness
        case 'BusinessFactArchived':
          return [free(event.data.entityId)];
        case 'CommandDefined':
        case 'CommandRenamed':
          return claim(
            event.data.modelId,
            event.data.entityId,
            event.data.name,
            'command',
          );
        case 'CommandFieldsUpdated':
          return []; // name-neutral (not in canHandle) — present for exhaustiveness
        case 'CommandArchived':
          return [free(event.data.entityId)];
        case 'ReadModelDefined':
        case 'ReadModelRenamed':
          return claim(
            event.data.modelId,
            event.data.entityId,
            event.data.name,
            'readModel',
          );
        case 'ReadModelFieldsUpdated':
          return []; // name-neutral
        case 'ReadModelArchived':
          return [free(event.data.entityId)];
        case 'WireframeDefined':
        case 'WireframeRenamed':
          return claim(
            event.data.modelId,
            event.data.entityId,
            event.data.name,
            'wireframe',
          );
        case 'WireframeContentUpdated':
          return []; // name-neutral
        case 'WireframeArchived':
          return [free(event.data.entityId)];
        case 'ExternalBusinessFactDefined':
        case 'ExternalBusinessFactRenamed':
          return claim(
            event.data.modelId,
            event.data.entityId,
            event.data.name,
            'externalBusinessFact',
          );
        case 'ExternalBusinessFactFieldsUpdated':
        case 'ExternalBusinessFactAssignedToContext':
        case 'ExternalBusinessFactContextCleared':
          return []; // name-neutral
        case 'ExternalBusinessFactArchived':
          return [free(event.data.entityId)];
        case 'AutomationDefined':
        case 'AutomationRenamed':
          return claim(
            event.data.modelId,
            event.data.entityId,
            event.data.name,
            'automation',
          );
        case 'AutomationReconfigured':
          return []; // name-neutral
        case 'AutomationArchived':
          return [free(event.data.entityId)];
        case 'TranslationDefined':
        case 'TranslationRenamed':
          return claim(
            event.data.modelId,
            event.data.entityId,
            event.data.name,
            'translation',
          );
        case 'TranslationMappingUpdated':
          return []; // name-neutral
        case 'TranslationArchived':
          return [free(event.data.entityId)];
      }
    }),
});
