import { postgreSQLRawBatchSQLProjection } from '@event-driven-io/emmett-postgresql';
import { sql, type SQL } from '@event-driven-io/dumbo';
import type { RelationEvent } from '../domain/relation/events.ts';

/**
 * CONSTRAINT projection — no duplicate relation `(fromId, toId, kind)` (E3), a
 * cross-aggregate set invariant: each relation is its own stream, so no decider
 * can see a sibling edge between the same endpoints.
 *
 * Registered INLINE → runs in the SAME transaction as the event append. The
 * `relation_pairs` `(from_id, to_id, kind)` PRIMARY KEY rejects the duplicate:
 * the INSERT throws → the append tx rolls back → the command fails (409).
 * A kind change re-keys (free by relation_id, claim the new triple); removal
 * frees. Table is created by src/schema.ts.
 */
export const relationPairsConstraint = postgreSQLRawBatchSQLProjection<RelationEvent>({
  name: 'relation_pairs_constraint',
  canHandle: ['RelationDrawn', 'RelationInfoUpdated', 'RelationRemoved'],
  evolve: (events): SQL[] =>
    events.flatMap((event): SQL[] => {
      switch (event.type) {
        case 'RelationDrawn':
        case 'RelationInfoUpdated':
          return [
            sql(
              'DELETE FROM relation_pairs WHERE relation_id = %L',
              event.data.relationId,
            ),
            sql(
              `INSERT INTO relation_pairs (from_id, to_id, kind, relation_id)
               VALUES (%L, %L, %L, %L)`,
              event.data.fromId,
              event.data.toId,
              event.data.kind,
              event.data.relationId,
            ),
          ];
        case 'RelationRemoved':
          return [
            sql(
              'DELETE FROM relation_pairs WHERE relation_id = %L',
              event.data.relationId,
            ),
          ];
      }
    }),
});
