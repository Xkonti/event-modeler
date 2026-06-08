import pg from 'pg';
import { connectionString as defaultConnectionString } from '../config.ts';

/**
 * Creates the strongly-consistent CONSTRAINT tables. These are load-bearing
 * (the write path depends on them), so they must exist before the first guarded
 * append — unlike read models, they are not auto-rebuilt from events.
 *
 *  - entity_names  : global entity-name uniqueness (PK on normalized_name).
 *  - entity_claims : session ownership, ≤1 session per entity (future; PK on
 *                    entity_id). Same pattern as names — see
 *                    notes/sessions-and-collaboration.md.
 *
 * Auth tables (notes/auth-architecture.md):
 *  - auth_user_keys        : deletable per-user DEK store — the crypto-shred lever.
 *  - auth_user_email_index : email blind-index + uniqueness (inline constraint).
 *  - auth_account_index    : account lookup + (provider_id, provider_account_id)
 *                            uniqueness (inline constraint).
 *  - auth_session          : plain better-auth session rows (no PII).
 *  - auth_verification     : plain better-auth one-shot tokens (inert in v1).
 *
 * Uses `pg` (not Bun-specific APIs) so it runs under both Bun and Node — the
 * latter matters because testcontainers integration tests run on Node.
 *
 * Run via `bun run migrate`, and also invoked on startup by src/index.ts.
 */
export const migrateConstraints = async (
  connectionString: string = defaultConnectionString,
): Promise<void> => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS entity_names (
        normalized_name text PRIMARY KEY,
        entity_id       text NOT NULL UNIQUE,
        entity_type     text NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS entity_claims (
        entity_id  text PRIMARY KEY,
        session_id text NOT NULL,
        claimed_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // --- Auth: deletable per-user DEK store (the crypto-shred lever) ---
    // wrapped_dek = {iv, authTag, ct} of the DEK under the KEK. Deleting a row
    // permanently shreds that user's PII + account ciphertext.
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_user_keys (
        user_id     text PRIMARY KEY,
        wrapped_dek jsonb NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    // --- Auth: email blind-index + uniqueness (inline constraint) ---
    // email_hash = hex HMAC-SHA256(EMAIL_INDEX_KEY, normalize(email)), computed
    // by the adapter and carried on the event. PK enforces one email globally;
    // a collision aborts the append tx → registration fails.
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_user_email_index (
        email_hash text PRIMARY KEY,
        user_id    text NOT NULL UNIQUE
      )
    `);

    // --- Auth: account lookup + uniqueness (inline constraint) ---
    // No PII (ids only). Serves findOne(providerId+accountId) on sign-in and
    // findMany(userId); UNIQUE blocks a duplicate account link.
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_account_index (
        account_id          text PRIMARY KEY,
        user_id             text NOT NULL,
        provider_id         text NOT NULL,
        provider_account_id text NOT NULL,
        UNIQUE (provider_id, provider_account_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS auth_account_index_user_id_idx
        ON auth_account_index (user_id)
    `);

    // --- Auth: plain session table (no PII; straight pg CRUD via adapter) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_session (
        id         text PRIMARY KEY,
        user_id    text NOT NULL,
        token      text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        ip_address text,
        user_agent text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS auth_session_user_id_idx
        ON auth_session (user_id)
    `);

    // --- Auth: plain verification table (one-shot tokens; inert in v1) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_verification (
        id         text PRIMARY KEY,
        identifier text NOT NULL,
        value      text NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS auth_verification_identifier_idx
        ON auth_verification (identifier)
    `);
  } finally {
    await client.end();
  }
};

if (import.meta.main) {
  await migrateConstraints();
  console.log(
    '✅ Constraint + auth tables ready (entity_names, entity_claims, ' +
      'auth_user_keys, auth_user_email_index, auth_account_index, ' +
      'auth_session, auth_verification).',
  );
}
