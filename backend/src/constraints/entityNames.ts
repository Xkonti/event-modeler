import { postgreSQLRawBatchSQLProjection } from '@event-driven-io/emmett-postgresql';
import { sql, type SQL } from '@event-driven-io/dumbo';
import { normalizeName } from '../shared/naming.ts';
import type { BusinessFactEvent } from '../domain/businessFact/events.ts';

/**
 * CONSTRAINT projection (not a read model) — enforces GLOBAL entity-name
 * uniqueness, a cross-aggregate *set* invariant no decider can see.
 *
 * Registered INLINE → these statements run in the SAME transaction as the event
 * append. The `entity_names.normalized_name` PRIMARY KEY rejects a colliding
 * name: the INSERT throws → the whole append tx rolls back → the command fails.
 *
 * Why this is a constraint, not a read model: the WRITE PATH depends on it to
 * decide whether the append may commit. See
 * notes/constraint-inline-projection-pattern.md.
 *
 * Table is created by src/migrations/constraints.ts (must exist before the
 * first guarded append).
 */
export const entityNamesConstraint =
  postgreSQLRawBatchSQLProjection<BusinessFactEvent>({
    name: 'entity_names_constraint',
    canHandle: [
      'BusinessFactDefined',
      'BusinessFactRenamed',
      'BusinessFactArchived',
    ],
    evolve: (events): SQL[] =>
      events.flatMap((event): SQL[] => {
        switch (event.type) {
          case 'BusinessFactDefined':
          case 'BusinessFactRenamed': {
            const entityId = event.data.factId;
            const name = normalizeName(event.data.name);
            // Free any prior name this entity held, then claim the new one.
            // The PK on normalized_name fails if another entity owns it.
            return [
              sql('DELETE FROM entity_names WHERE entity_id = %L', entityId),
              sql(
                `INSERT INTO entity_names (normalized_name, entity_id, entity_type)
                 VALUES (%L, %L, %L)`,
                name,
                entityId,
                'businessFact',
              ),
            ];
          }
          case 'BusinessFactArchived':
            return [
              sql(
                'DELETE FROM entity_names WHERE entity_id = %L',
                event.data.factId,
              ),
            ];
        }
      }),
  });
