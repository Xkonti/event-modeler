import pg from 'pg';
import { connectionString as defaultConnectionString } from '../config.ts';
import { assertConstrained, buildWhere, type AdapterWhere } from './sqlWhere.ts';

/**
 * Plain `pg` CRUD for the ephemeral `auth_session` table (no PII → no crypto,
 * notes/auth-architecture.md). Maps better-auth camelCase ↔ snake_case
 * columns and translates the adapter `where` shapes to parameterized SQL.
 *
 * Node-safe (`pg`, no Bun globals) — integration runs under Node.
 */
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

/** better-auth session field → column. */
const COLUMN: Record<string, string> = {
  id: 'id',
  userId: 'user_id',
  token: 'token',
  expiresAt: 'expires_at',
  ipAddress: 'ip_address',
  userAgent: 'user_agent',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

type SessionRow = {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  updated_at: Date;
};

export type PlainSession = {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const toSession = (r: SessionRow): PlainSession => ({
  id: r.id,
  userId: r.user_id,
  token: r.token,
  expiresAt: r.expires_at,
  ipAddress: r.ip_address,
  userAgent: r.user_agent,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const col = (field: string): string => {
  const c = COLUMN[field];
  if (!c) throw new Error(`Unsupported session field '${field}'`);
  return c;
};

type Opts = { connectionString?: string };

const run = <T>(opts: Opts, fn: (c: Queryable) => Promise<T>): Promise<T> =>
  withClient(opts.connectionString ?? defaultConnectionString, fn);

export const createSession = (
  data: Record<string, unknown>,
  opts: Opts = {},
): Promise<PlainSession> =>
  run(opts, async (client) => {
    const fields = Object.keys(data);
    const cols = fields.map(col);
    const params = fields.map((_, i) => `$${i + 1}`);
    const values = fields.map((f) => data[f]);
    const res = await client.query<SessionRow>(
      `INSERT INTO auth_session (${cols.join(', ')})
       VALUES (${params.join(', ')})
       RETURNING *`,
      values,
    );
    return toSession(res.rows[0]!);
  });

export const findOneSession = (
  where: AdapterWhere[],
  opts: Opts = {},
): Promise<PlainSession | null> =>
  run(opts, async (client) => {
    const { clause, values } = buildWhere(where, col);
    const res = await client.query<SessionRow>(
      `SELECT * FROM auth_session ${clause} LIMIT 1`,
      values,
    );
    return res.rows[0] ? toSession(res.rows[0]) : null;
  });

export const findManySessions = (
  where: AdapterWhere[] | undefined,
  opts: Opts & {
    limit?: number;
    offset?: number;
    sortBy?: { field: string; direction: 'asc' | 'desc' };
  } = {},
): Promise<PlainSession[]> =>
  run(opts, async (client) => {
    const { clause, values } = buildWhere(where ?? [], col);
    let sql = `SELECT * FROM auth_session ${clause}`;
    if (opts.sortBy)
      sql += ` ORDER BY ${col(opts.sortBy.field)} ${opts.sortBy.direction === 'desc' ? 'DESC' : 'ASC'}`;
    if (typeof opts.limit === 'number') sql += ` LIMIT ${Math.trunc(opts.limit)}`;
    if (typeof opts.offset === 'number') sql += ` OFFSET ${Math.trunc(opts.offset)}`;
    const res = await client.query<SessionRow>(sql, values);
    return res.rows.map(toSession);
  });

export const updateSession = (
  where: AdapterWhere[],
  update: Record<string, unknown>,
  opts: Opts = {},
): Promise<PlainSession | null> =>
  run(opts, async (client) => {
    assertConstrained(where, 'session update');
    const fields = Object.keys(update);
    if (fields.length === 0) return findOneSession(where, opts);
    const setCols = fields.map((f, i) => `${col(f)} = $${i + 1}`);
    const setValues = fields.map((f) => update[f]);
    const { clause, values } = buildWhere(where, col, fields.length);
    const res = await client.query<SessionRow>(
      `UPDATE auth_session SET ${setCols.join(', ')} ${clause} RETURNING *`,
      [...setValues, ...values],
    );
    return res.rows[0] ? toSession(res.rows[0]) : null;
  });

export const deleteSession = (
  where: AdapterWhere[],
  opts: Opts = {},
): Promise<void> =>
  run(opts, async (client) => {
    assertConstrained(where, 'session delete');
    const { clause, values } = buildWhere(where, col);
    await client.query(`DELETE FROM auth_session ${clause}`, values);
  });

export const deleteManySessions = (
  where: AdapterWhere[],
  opts: Opts = {},
): Promise<number> =>
  run(opts, async (client) => {
    assertConstrained(where, 'session deleteMany');
    const { clause, values } = buildWhere(where, col);
    const res = await client.query(`DELETE FROM auth_session ${clause}`, values);
    return res.rowCount ?? 0;
  });

export const countSessions = (
  where: AdapterWhere[] | undefined,
  opts: Opts = {},
): Promise<number> =>
  run(opts, async (client) => {
    const { clause, values } = buildWhere(where ?? [], col);
    const res = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM auth_session ${clause}`,
      values,
    );
    return Number(res.rows[0]?.count ?? 0);
  });
