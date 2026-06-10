import pg from 'pg';
import { connectionString as defaultConnectionString } from './config.ts';

/**
 * Creates the app's non-Emmett tables: the strongly-consistent CONSTRAINT tables
 * (load-bearing — the write path depends on them) plus the auth tables. Emmett
 * owns its own `emt_*` schema (`eventStore.schema.migrate()`); this owns the rest.
 *
 * NO migrations: the DB is wiped and recreated, never upgraded in place. So this
 * is plain first-time table creation on a fresh DB, run at boot (src/index.ts)
 * and by the integration harness. There is no versioning, ALTER, or upgrade path.
 *
 *  - entity_names  : per-model entity-name uniqueness across all named types
 *                    (PK on (model_id, normalized_name); F1b). One namespace per
 *                    model — a command can't share a name with a fact.
 *  - entity_claims : session ownership, ≤1 session per entity (future; PK on
 *                    entity_id). Same pattern as names —
 *                    see notes/sessions-and-collaboration.md.
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
 */
export const createSchema = async (
  connectionString: string = defaultConnectionString,
): Promise<void> => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS entity_names (
        model_id        text NOT NULL,
        normalized_name text NOT NULL,
        entity_id       text NOT NULL UNIQUE,
        entity_type     text NOT NULL,
        PRIMARY KEY (model_id, normalized_name)
      )
    `);

    // Context (lane) names — contexts' OWN namespace, separate from
    // entity_names (G-C2): a lane may share its name with a fact, never with
    // another lane in the same model.
    await client.query(`
      CREATE TABLE IF NOT EXISTS context_names (
        model_id        text NOT NULL,
        normalized_name text NOT NULL,
        context_id      text NOT NULL UNIQUE,
        PRIMARY KEY (model_id, normalized_name)
      )
    `);

    // Chapter (C1 band) names — chapters' OWN namespace, separate from
    // entity_names and context_names (G-C2): a chapter may share its name with
    // a fact or a lane, never with another chapter in the same model.
    await client.query(`
      CREATE TABLE IF NOT EXISTS chapter_names (
        model_id        text NOT NULL,
        normalized_name text NOT NULL,
        chapter_id      text NOT NULL UNIQUE,
        PRIMARY KEY (model_id, normalized_name)
      )
    `);

    // Relation pair uniqueness — no duplicate (from, to, kind) edge (E3). Each
    // relation is its own stream, so this set invariant is enforced inline.
    await client.query(`
      CREATE TABLE IF NOT EXISTS relation_pairs (
        from_id     text NOT NULL,
        to_id       text NOT NULL,
        kind        text NOT NULL,
        relation_id text NOT NULL UNIQUE,
        PRIMARY KEY (from_id, to_id, kind)
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
