/**
 * Keystore access — the deletable per-user DEK store (`auth_user_keys`).
 *
 * THIS table is the shred lever: each row holds one user's DEK wrapped under the
 * KEK. Deleting the row makes all that user's ciphertext (PII events + their
 * account secrets) permanently unrecoverable (notes/auth-architecture.md).
 *
 * Plain `pg` (not Bun-specific) so it runs under both Bun and Node — the latter
 * for testcontainers integration. Each
 * fn opens + closes its own short-lived client, taking a connection string like
 * the schema module; an optional already-connected client lets the adapter
 * run a put inside a wider unit of work.
 */
import pg from 'pg';
import { connectionString as defaultConnectionString } from '../config.ts';
import type { Cipher } from './crypto.ts';

/** Anything that can run a parameterized query (pg.Client or pg.Pool). */
type Queryable = Pick<pg.Client, 'query'>;

const withClient = async <T>(
  connectionString: string,
  fn: (client: Queryable) => Promise<T>,
): Promise<T> => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
};

/**
 * Store (or replace) a user's wrapped DEK. Upsert so a re-run is idempotent.
 * Pass an existing `client` to participate in a caller-owned connection.
 */
export const putWrappedDek = async (
  userId: string,
  wrappedDek: Cipher,
  opts: { connectionString?: string; client?: Queryable } = {},
): Promise<void> => {
  const run = (client: Queryable) =>
    client.query(
      `INSERT INTO auth_user_keys (user_id, wrapped_dek)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET wrapped_dek = EXCLUDED.wrapped_dek`,
      [userId, wrappedDek],
    );
  if (opts.client) {
    await run(opts.client);
    return;
  }
  await withClient(opts.connectionString ?? defaultConnectionString, run);
};

/**
 * Load a user's wrapped DEK, or `null` if the row is gone (shredded / never
 * existed). A `null` here is the post-shred signal the adapter turns into
 * "no such user".
 */
export const getWrappedDek = async (
  userId: string,
  opts: { connectionString?: string; client?: Queryable } = {},
): Promise<Cipher | null> => {
  const run = async (client: Queryable): Promise<Cipher | null> => {
    const res = await client.query<{ wrapped_dek: Cipher }>(
      'SELECT wrapped_dek FROM auth_user_keys WHERE user_id = $1',
      [userId],
    );
    return res.rows[0]?.wrapped_dek ?? null;
  };
  if (opts.client) return run(opts.client);
  return withClient(opts.connectionString ?? defaultConnectionString, run);
};

/**
 * Delete a user's DEK row — THE SHRED. Irreversible: after this the user's
 * ciphertext can never be decrypted again. Idempotent (deleting a missing row
 * is a no-op).
 */
export const deleteDek = async (
  userId: string,
  opts: { connectionString?: string; client?: Queryable } = {},
): Promise<void> => {
  const run = (client: Queryable) =>
    client.query('DELETE FROM auth_user_keys WHERE user_id = $1', [userId]);
  if (opts.client) {
    await run(opts.client);
    return;
  }
  await withClient(opts.connectionString ?? defaultConnectionString, run);
};
