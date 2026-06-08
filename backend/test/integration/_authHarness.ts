/**
 * Shared integration harness for the auth API E2E suites (A1–A5 / B6–B9 /
 * C10–C14). Underscore-prefixed so the `*.test.ts` glob skips it.
 *
 * Runs under `node --test` (testcontainers' lifecycle probe hangs under Bun).
 * Every src module it touches is loaded
 * via dynamic `import()` AFTER the test env is set, because the singletons bind
 * the connection string + crypto keys at module-load:
 *   - config.ts        reads POSTGRESQL_CONNECTION_STRING / BETTER_AUTH_URL.
 *   - keys.ts          validates AUTH_KEK / EMAIL_INDEX_KEY / BETTER_AUTH_SECRET (throws if absent).
 *   - eventStore.ts    builds the singleton store on connectionString.
 *   - db.ts / auth.ts  bind the same connectionString + the adapter.
 * So the harness MUST NOT statically import any of those; it imports them only
 * inside `bootAuthHarness()` once the container URI + fixed keys are in env.
 *
 * What it gives the suites:
 *   - a real Postgres (testcontainers `postgres:16-alpine`), migrated exactly as
 *     `nameUniqueness.test.ts` does (`eventStore.schema.migrate()` +
 *     `migrateConstraints(uri)`);
 *   - the REAL Express app from `buildAuthApp({ auth, eventStore })` listening on
 *     an ephemeral port (`startAPI(app, { port: 0 })`) — the same HTTP assembly
 *     prod runs, so the auth-raw-before-json ordering is exercised, not faked;
 *   - a cookie-jar `fetch` (captures + replays `set-cookie`) for HTTP flows;
 *   - `pgQuery` for direct at-rest assertions on `emt_messages` + the auth tables;
 *   - signup / login / logout helpers, the email blind index, the crypto
 *     primitives, and a `shred()` that drives the real adapter `delete(user)`
 *     path (THE SHRED).
 */
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import type { Server } from 'node:http';
import pg from 'pg';
import { randomBytes } from 'node:crypto';

// --- fixed test secrets (set in env BEFORE any src module loads) ------------
// 32-byte base64 keys + a >=32-char secret, deterministic across the process so
// encrypt/decrypt + the blind index are stable for at-rest assertions.
const TEST_ENV = {
  AUTH_KEK: randomBytes(32).toString('base64'),
  EMAIL_INDEX_KEY: randomBytes(32).toString('base64'),
  BETTER_AUTH_SECRET: 'test-secret-please-change-32+chars-long-x',
  BETTER_AUTH_URL: 'http://127.0.0.1:5173',
  AUTH_TRUSTED_ORIGINS: 'http://127.0.0.1:5173',
} as const;

// Loaded lazily in bootAuthHarness (dynamic import after env is set).
type Cipher = { iv: string; authTag: string; ct: string };

export type AuthHarness = {
  baseURL: string;
  connectionString: string;
  /** Direct DB query on the same container (at-rest assertions). */
  pgQuery: <T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<T[]>;
  /** A cookie-jar fetch: captures `set-cookie`, replays on subsequent calls. */
  jar: () => CookieJar;
  /** Email blind index (hex HMAC-SHA256) — same fn the adapter uses. */
  emailBlindIndex: (email: string) => string;
  /** Decrypt a field cipher under a DEK (positive/negative controls). */
  decrypt: (dek: Buffer, c: Cipher) => string;
  /** Unwrap a KEK-wrapped DEK blob. */
  unwrapDek: (wrapped: Cipher) => Buffer;
  /** Load a user's wrapped DEK from the keystore (null after shred). */
  getWrappedDek: (userId: string) => Promise<Cipher | null>;
  /** Run THE SHRED via the real adapter `delete(user)` path. */
  shred: (userId: string) => Promise<void>;
};

/** A minimal cookie jar around `fetch`. Replays captured cookies; honors clears. */
export type CookieJar = {
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  cookies: () => Map<string, string>;
  cookieHeader: () => string;
};

let container: StartedPostgreSqlContainer | undefined;
let server: Server | undefined;
let harness: AuthHarness | undefined;

/**
 * Parse a `set-cookie` header value into name + value, honoring deletion
 * (`Max-Age=0` / a past `Expires`) which marks the cookie as cleared.
 */
const applySetCookie = (jar: Map<string, string>, raw: string): void => {
  const [pair, ...attrs] = raw.split(';');
  if (!pair) return;
  const eq = pair.indexOf('=');
  if (eq < 0) return;
  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  const lowerAttrs = attrs.map((a) => a.trim().toLowerCase());
  const maxAgeZero = lowerAttrs.some((a) => a === 'max-age=0' || a === 'max-age=-1');
  const expiredPast = lowerAttrs.some((a) => {
    if (!a.startsWith('expires=')) return false;
    const when = Date.parse(a.slice('expires='.length));
    return Number.isFinite(when) && when <= Date.now();
  });
  if (value === '' || maxAgeZero || expiredPast) {
    jar.delete(name); // a cleared cookie — logout path relies on this
    return;
  }
  jar.set(name, value);
};

/** Read every `set-cookie` from a Response across runtimes (getSetCookie or raw). */
const readSetCookies = (res: Response): string[] => {
  const anyHeaders = res.headers as unknown as {
    getSetCookie?: () => string[];
  };
  if (typeof anyHeaders.getSetCookie === 'function') return anyHeaders.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
};

const makeJar = (baseURL: string): CookieJar => {
  const cookies = new Map<string, string>();
  const cookieHeader = () =>
    [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  const doFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (cookies.size > 0) headers.set('cookie', cookieHeader());
    // better-auth runs a CSRF/origin check and 403s a missing Origin
    // (`MISSING_OR_NULL_ORIGIN`). A real browser sends the proxied origin
    // (`BETTER_AUTH_URL` = the :5173 Vite origin, a trustedOrigin); replicate it
    // so the harness exercises the same trusted-origin path the browser takes.
    if (!headers.has('origin')) headers.set('origin', TEST_ENV.BETTER_AUTH_URL);
    const res = await fetch(`${baseURL}${path}`, { ...init, headers });
    for (const sc of readSetCookies(res)) applySetCookie(cookies, sc);
    return res;
  };
  return { fetch: doFetch, cookies: () => cookies, cookieHeader };
};

/**
 * Boot the container + REAL app ONCE per test file (call inside `describe`'s
 * `before`). Idempotent across describes in the SAME file via the module-level
 * singleton; each test FILE is its own process under `node --test`, so a fresh
 * container per file is fine.
 */
export const bootAuthHarness = async (): Promise<AuthHarness> => {
  if (harness) return harness;

  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const connectionString = container.getConnectionUri();

  // Env MUST be set before importing any src module (singletons bind at load).
  process.env.POSTGRESQL_CONNECTION_STRING = connectionString;
  for (const [k, v] of Object.entries(TEST_ENV)) process.env[k] = v;

  // Dynamic imports — now that env is in place. We use the SINGLETON eventStore
  // (the one auth.ts binds its adapter to) so the app + the harness share one
  // store + connection pool; closing it cleanly on teardown avoids the
  // "terminating connection due to administrator command" the container stop
  // would otherwise raise on a still-open short-lived pg client.
  const storeMod = await import('../../src/eventStore.ts');
  const { migrateConstraints } = await import('../../src/migrations/constraints.ts');
  const crypto = await import('../../src/auth/crypto.ts');
  const keystore = await import('../../src/auth/keystore.ts');
  const { esCryptoAdapter } = await import('../../src/auth/adapter.ts');
  const { auth } = await import('../../src/auth/auth.ts');
  const { buildAuthApp } = await import('../../src/http/app.ts');
  const { startAPI } = await import('@event-driven-io/emmett-expressjs');

  const eventStore = storeMod.eventStore; // singleton, bound to connectionString
  await eventStore.schema.migrate();
  await migrateConstraints(connectionString);
  teardowns.push(async () => {
    await eventStore.close();
  });

  // db.ts opens a Pongo client (its own pool) at module-load — buildAuthApp pulls
  // it in transitively via the businessFact GET route. Close it on teardown so no
  // pool connection is left open when the container stops (else node --test flags
  // "asynchronous activity after the test ended").
  const dbMod = await import('../../src/db.ts');
  teardowns.push(async () => {
    await dbMod.pongo.close();
  });

  const app = buildAuthApp({ auth, eventStore });
  server = startAPI(app, { port: 0 });
  await new Promise<void>((resolve, reject) => {
    server!.once('listening', () => resolve());
    server!.once('error', reject);
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string')
    throw new Error('startAPI did not bind a TCP port');
  const baseURL = `http://127.0.0.1:${addr.port}`;

  // Direct-DB helper — its own short-lived pool on the same container URI.
  const pool = new pg.Pool({ connectionString });
  const pgQuery = async <T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> => {
    const res = await pool.query(sql, params);
    return res.rows as T[];
  };

  // The real adapter instance (factory bound to the SAME store the app uses).
  // Calling `.delete({model:'user', ...})` runs THE SHRED end-to-end.
  const adapter = esCryptoAdapter(eventStore)(auth.options as never);
  const shred = (userId: string): Promise<void> =>
    adapter.delete({ model: 'user', where: [{ field: 'id', value: userId }] });

  harness = {
    baseURL,
    connectionString,
    pgQuery,
    jar: () => makeJar(baseURL),
    emailBlindIndex: crypto.emailBlindIndex,
    decrypt: crypto.decrypt,
    unwrapDek: crypto.unwrapDek,
    getWrappedDek: (userId: string) =>
      keystore.getWrappedDek(userId, { connectionString }),
    shred,
  };

  // Tear the pool down with the rest of the harness.
  teardowns.push(async () => {
    await pool.end();
  });
  return harness;
};

const teardowns: Array<() => Promise<void>> = [];

/** Stop the server + container. Call inside `describe`'s `after`. */
export const stopAuthHarness = async (): Promise<void> => {
  for (const t of teardowns.splice(0)) await t().catch(() => {});
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
  await container?.stop();
  container = undefined;
  harness = undefined;
};

// --- HTTP flow helpers ------------------------------------------------------

export type Credentials = { email: string; password: string; name?: string };

/** A unique throwaway credential set per call. */
export const freshCreds = (overrides: Partial<Credentials> = {}): Credentials => {
  const tag = randomBytes(6).toString('hex');
  return {
    email: `user-${tag}@example.test`,
    password: 'correct horse battery staple',
    name: `User ${tag}`,
    ...overrides,
  };
};

const postJson = (jar: CookieJar, path: string, body: unknown) =>
  jar.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

/** POST /api/auth/sign-up/email. Returns the response (cookies land in the jar). */
export const signup = (jar: CookieJar, c: Credentials): Promise<Response> =>
  postJson(jar, '/api/auth/sign-up/email', {
    email: c.email,
    password: c.password,
    name: c.name ?? c.email,
  });

/** POST /api/auth/sign-in/email. */
export const login = (
  jar: CookieJar,
  c: Pick<Credentials, 'email' | 'password'>,
): Promise<Response> =>
  postJson(jar, '/api/auth/sign-in/email', {
    email: c.email,
    password: c.password,
  });

/** POST /api/auth/sign-out. */
export const logout = (jar: CookieJar): Promise<Response> =>
  postJson(jar, '/api/auth/sign-out', {});

/** True if the jar holds a better-auth session cookie (assert by PREFIX). */
export const hasSessionCookie = (jar: CookieJar): boolean =>
  [...jar.cookies().keys()].some((n) =>
    n.startsWith('better-auth.session_token'),
  );

/**
 * Resolve a user's id from the email blind-index table WITHOUT touching any
 * plaintext (the index holds only `email_hash` + `user_id`).
 */
export const userIdForEmail = async (
  h: AuthHarness,
  email: string,
): Promise<string | null> => {
  const rows = await h.pgQuery<{ user_id: string }>(
    'SELECT user_id FROM auth_user_email_index WHERE email_hash = $1',
    [h.emailBlindIndex(email)],
  );
  return rows[0]?.user_id ?? null;
};
