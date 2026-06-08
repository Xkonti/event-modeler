import pg from 'pg';
import { connectionString as defaultConnectionString } from '../config.ts';
import { assertConstrained, buildWhere, type AdapterWhere } from './sqlWhere.ts';

/**
 * Plain `pg` CRUD for the ephemeral `auth_verification` table (one-shot tokens;
 * inert in v1 — email-verify disabled, password-reset deferred). No
 * durable PII → no crypto. Same camel↔snake + where-translation pattern as
 * sessionStore.
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

const COLUMN: Record<string, string> = {
  id: 'id',
  identifier: 'identifier',
  value: 'value',
  expiresAt: 'expires_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

type VerificationRow = {
  id: string;
  identifier: string;
  value: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
};

export type PlainVerification = {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const toVerification = (r: VerificationRow): PlainVerification => ({
  id: r.id,
  identifier: r.identifier,
  value: r.value,
  expiresAt: r.expires_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const col = (field: string): string => {
  const c = COLUMN[field];
  if (!c) throw new Error(`Unsupported verification field '${field}'`);
  return c;
};

type Opts = { connectionString?: string };

const run = <T>(opts: Opts, fn: (c: Queryable) => Promise<T>): Promise<T> =>
  withClient(opts.connectionString ?? defaultConnectionString, fn);

export const createVerification = (
  data: Record<string, unknown>,
  opts: Opts = {},
): Promise<PlainVerification> =>
  run(opts, async (client) => {
    const fields = Object.keys(data);
    const cols = fields.map(col);
    const params = fields.map((_, i) => `$${i + 1}`);
    const values = fields.map((f) => data[f]);
    const res = await client.query<VerificationRow>(
      `INSERT INTO auth_verification (${cols.join(', ')})
       VALUES (${params.join(', ')})
       RETURNING *`,
      values,
    );
    return toVerification(res.rows[0]!);
  });

export const findOneVerification = (
  where: AdapterWhere[],
  opts: Opts = {},
): Promise<PlainVerification | null> =>
  run(opts, async (client) => {
    const { clause, values } = buildWhere(where, col);
    const res = await client.query<VerificationRow>(
      `SELECT * FROM auth_verification ${clause} LIMIT 1`,
      values,
    );
    return res.rows[0] ? toVerification(res.rows[0]) : null;
  });

export const findManyVerifications = (
  where: AdapterWhere[] | undefined,
  opts: Opts & {
    limit?: number;
    offset?: number;
    sortBy?: { field: string; direction: 'asc' | 'desc' };
  } = {},
): Promise<PlainVerification[]> =>
  run(opts, async (client) => {
    const { clause, values } = buildWhere(where ?? [], col);
    let sql = `SELECT * FROM auth_verification ${clause}`;
    if (opts.sortBy)
      sql += ` ORDER BY ${col(opts.sortBy.field)} ${opts.sortBy.direction === 'desc' ? 'DESC' : 'ASC'}`;
    if (typeof opts.limit === 'number') sql += ` LIMIT ${Math.trunc(opts.limit)}`;
    if (typeof opts.offset === 'number') sql += ` OFFSET ${Math.trunc(opts.offset)}`;
    const res = await client.query<VerificationRow>(sql, values);
    return res.rows.map(toVerification);
  });

export const updateVerification = (
  where: AdapterWhere[],
  update: Record<string, unknown>,
  opts: Opts = {},
): Promise<PlainVerification | null> =>
  run(opts, async (client) => {
    assertConstrained(where, 'verification update');
    const fields = Object.keys(update);
    if (fields.length === 0) return findOneVerification(where, opts);
    const setCols = fields.map((f, i) => `${col(f)} = $${i + 1}`);
    const setValues = fields.map((f) => update[f]);
    const { clause, values } = buildWhere(where, col, fields.length);
    const res = await client.query<VerificationRow>(
      `UPDATE auth_verification SET ${setCols.join(', ')} ${clause} RETURNING *`,
      [...setValues, ...values],
    );
    return res.rows[0] ? toVerification(res.rows[0]) : null;
  });

export const deleteVerification = (
  where: AdapterWhere[],
  opts: Opts = {},
): Promise<void> =>
  run(opts, async (client) => {
    assertConstrained(where, 'verification delete');
    const { clause, values } = buildWhere(where, col);
    await client.query(`DELETE FROM auth_verification ${clause}`, values);
  });

export const deleteManyVerifications = (
  where: AdapterWhere[],
  opts: Opts = {},
): Promise<number> =>
  run(opts, async (client) => {
    assertConstrained(where, 'verification deleteMany');
    const { clause, values } = buildWhere(where, col);
    const res = await client.query(
      `DELETE FROM auth_verification ${clause}`,
      values,
    );
    return res.rowCount ?? 0;
  });

export const countVerifications = (
  where: AdapterWhere[] | undefined,
  opts: Opts = {},
): Promise<number> =>
  run(opts, async (client) => {
    const { clause, values } = buildWhere(where ?? [], col);
    const res = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM auth_verification ${clause}`,
      values,
    );
    return Number(res.rows[0]?.count ?? 0);
  });
