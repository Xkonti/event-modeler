import { postgreSQLRawBatchSQLProjection } from '@event-driven-io/emmett-postgresql';
import { sql, type SQL } from '@event-driven-io/dumbo';
import { normalizeName } from '../shared/naming.ts';
import type { BusinessFactEvent } from '../domain/businessFact/events.ts';
import type { CommandEvent } from '../domain/command/events.ts';
import type { EntityType } from '../shared/streams.ts';

/**
 * CONSTRAINT projection (not a read model) — enforces GLOBAL entity-name
 * uniqueness across every NAMED entity type (business facts + commands), a
 * cross-aggregate *set* invariant no decider can see.
 *
 * Registered INLINE → these statements run in the SAME transaction as the event
 * append. The `entity_names.normalized_name` PRIMARY KEY rejects a colliding
 * name: the INSERT throws → the whole append tx rolls back → the command fails.
 *
 * Why a constraint, not a read model: the WRITE PATH depends on it to decide
 * whether the append may commit. See
 * notes/constraint-inline-projection-pattern.md. Relations are NOT here — they
 * carry no name. Slices are NOT here — slice names aren't globally unique in v1.
 *
 * Table is created by src/migrations/constraints.ts.
 */

/** Free any prior name this entity held, then claim the new one. */
const claim = (
  entityId: string,
  rawName: string,
  entityType: EntityType,
): SQL[] => [
  sql('DELETE FROM entity_names WHERE entity_id = %L', entityId),
  sql(
    `INSERT INTO entity_names (normalized_name, entity_id, entity_type)
     VALUES (%L, %L, %L)`,
    normalizeName(rawName),
    entityId,
    entityType,
  ),
];

const free = (entityId: string): SQL =>
  sql('DELETE FROM entity_names WHERE entity_id = %L', entityId);

export const entityNamesConstraint = postgreSQLRawBatchSQLProjection<
  BusinessFactEvent | CommandEvent
>({
  name: 'entity_names_constraint',
  canHandle: [
    'BusinessFactDefined',
    'BusinessFactRenamed',
    'BusinessFactArchived',
    'CommandDefined',
    'CommandRenamed',
    'CommandArchived',
  ],
  evolve: (events): SQL[] =>
    events.flatMap((event): SQL[] => {
      switch (event.type) {
        case 'BusinessFactDefined':
        case 'BusinessFactRenamed':
          return claim(event.data.entityId, event.data.name, 'businessFact');
        case 'BusinessFactArchived':
          return [free(event.data.entityId)];
        case 'CommandDefined':
        case 'CommandRenamed':
          return claim(event.data.entityId, event.data.name, 'command');
        case 'CommandArchived':
          return [free(event.data.entityId)];
      }
    }),
});
