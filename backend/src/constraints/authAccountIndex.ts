import { postgreSQLRawBatchSQLProjection } from '@event-driven-io/emmett-postgresql';
import { sql, type SQL } from '@event-driven-io/dumbo';
import type { AccountEvent } from '../domain/account/events.ts';

/**
 * CONSTRAINT projection — account lookup index AND `(providerId,
 * providerAccountId)` uniqueness. Registered INLINE → runs in the append tx
 * (notes/auth-architecture.md).
 *
 * Serves better-auth's two account query shapes: findOne by
 * (providerId + providerAccountId) on sign-in, and findMany by userId. Holds
 * ids ONLY (no PII/secret). UNIQUE (provider_id, provider_account_id) blocks a
 * duplicate account link — the INSERT throws → append rolls back.
 *
 * Table created by src/schema.ts.
 */
export const authAccountIndex = postgreSQLRawBatchSQLProjection<AccountEvent>({
  name: 'auth_account_index_constraint',
  canHandle: ['AccountLinked', 'AccountErased'],
  evolve: (events): SQL[] =>
    events.flatMap((event): SQL[] => {
      switch (event.type) {
        case 'AccountLinked':
          return [
            sql(
              `INSERT INTO auth_account_index
                 (account_id, user_id, provider_id, provider_account_id)
               VALUES (%L, %L, %L, %L)`,
              event.data.accountId,
              event.data.userId,
              event.data.providerId,
              event.data.providerAccountId,
            ),
          ];
        case 'AccountErased':
          return [
            sql(
              'DELETE FROM auth_account_index WHERE account_id = %L',
              event.data.accountId,
            ),
          ];
        default:
          return [];
      }
    }),
});
