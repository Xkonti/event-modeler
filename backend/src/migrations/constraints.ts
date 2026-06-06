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
  } finally {
    await client.end();
  }
};

if (import.meta.main) {
  await migrateConstraints();
  console.log('✅ Constraint tables ready (entity_names, entity_claims).');
}
