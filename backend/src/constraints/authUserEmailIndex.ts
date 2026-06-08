import { postgreSQLRawBatchSQLProjection } from '@event-driven-io/emmett-postgresql';
import { sql, type SQL } from '@event-driven-io/dumbo';
import type { UserEvent } from '../domain/user/events.ts';

/**
 * CONSTRAINT projection (not a read model) — email blind-index lookup AND global
 * email uniqueness. Registered INLINE → these statements run in the SAME
 * transaction as the user-event append (notes/auth-architecture.md).
 *
 * The `auth_user_email_index.email_hash` PRIMARY KEY rejects a colliding email:
 * the INSERT throws → the append tx rolls back → the adapter `create`/email
 * change fails → better-auth surfaces "email already exists".
 *
 * `email_hash` is read FROM the event (`data.emailHash`) — the adapter computes
 * the HMAC blind index before append; inline SQL cannot HMAC (no key in SQL).
 * The hash is non-reversible → safe at rest. Same free-then-claim shape as
 * `entityNames.ts`.
 *
 * Table created by src/migrations/constraints.ts.
 */
export const authUserEmailIndex = postgreSQLRawBatchSQLProjection<UserEvent>({
  name: 'auth_user_email_index_constraint',
  canHandle: ['UserRegistered', 'UserEmailChanged', 'UserErased'],
  evolve: (events): SQL[] =>
    events.flatMap((event): SQL[] => {
      switch (event.type) {
        case 'UserRegistered':
          return [
            sql(
              `INSERT INTO auth_user_email_index (email_hash, user_id)
               VALUES (%L, %L)`,
              event.data.emailHash,
              event.data.userId,
            ),
          ];
        case 'UserEmailChanged':
          // Free this user's prior hash, then claim the new one. PK on the new
          // email_hash fails if another user owns it (collision → rollback).
          return [
            sql(
              'DELETE FROM auth_user_email_index WHERE user_id = %L',
              event.data.userId,
            ),
            sql(
              `INSERT INTO auth_user_email_index (email_hash, user_id)
               VALUES (%L, %L)`,
              event.data.emailHash,
              event.data.userId,
            ),
          ];
        case 'UserErased':
          // Frees the email for re-registration; removes the last hash.
          return [
            sql(
              'DELETE FROM auth_user_email_index WHERE user_id = %L',
              event.data.userId,
            ),
          ];
        default:
          return [];
      }
    }),
});
