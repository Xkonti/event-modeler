import { postgreSQLRawBatchSQLProjection } from '@event-driven-io/emmett-postgresql';
import { sql, type SQL } from '@event-driven-io/dumbo';
import { normalizeName } from '../shared/naming.ts';
import type { ContextEvent } from '../domain/context/events.ts';

/**
 * CONSTRAINT projection — per-model CONTEXT-name uniqueness. Contexts live in
 * their OWN namespace, separate from `entity_names` (G-C2): a lane may share its
 * name with a fact, but not with another lane in the same model.
 *
 * Registered INLINE → runs in the SAME transaction as the event append. The
 * `context_names` `(model_id, normalized_name)` PRIMARY KEY rejects a colliding
 * name: the INSERT throws → the append tx rolls back → the command fails (409).
 * Archiving frees the name (G-C3). Table is created by src/schema.ts.
 */
export const contextNamesConstraint = postgreSQLRawBatchSQLProjection<ContextEvent>({
  name: 'context_names_constraint',
  canHandle: ['ContextDefined', 'ContextRenamed', 'ContextArchived'],
  evolve: (events): SQL[] =>
    events.flatMap((event): SQL[] => {
      switch (event.type) {
        case 'ContextDefined':
        case 'ContextRenamed':
          return [
            sql('DELETE FROM context_names WHERE context_id = %L', event.data.contextId),
            sql(
              `INSERT INTO context_names (model_id, normalized_name, context_id)
               VALUES (%L, %L, %L)`,
              event.data.modelId,
              normalizeName(event.data.name),
              event.data.contextId,
            ),
          ];
        case 'ContextArchived':
          return [
            sql('DELETE FROM context_names WHERE context_id = %L', event.data.contextId),
          ];
      }
    }),
});
