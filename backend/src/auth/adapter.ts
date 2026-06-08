import pg from 'pg';
import { createAdapterFactory } from 'better-auth/adapters';
import type { AppEventStore } from '../eventStore.ts';
import { connectionString as defaultConnectionString } from '../config.ts';
import {
  encrypt,
  encryptJson,
  emailBlindIndex,
  generateDek,
  unwrapDek,
  wrapDek,
} from './crypto.ts';
import { deleteDek, getWrappedDek, putWrappedDek } from './keystore.ts';
import { readUser, type PlainUser } from './readUser.ts';
import { readAccount, type AccountTokens, type PlainAccount } from './readAccount.ts';
import { handleUser } from '../domain/user/commandHandler.ts';
import { decide as decideUser, type UserCommand } from '../domain/user/user.ts';
import { handleAccount } from '../domain/account/commandHandler.ts';
import { decide as decideAccount, type AccountCommand } from '../domain/account/account.ts';
import {
  countSessions,
  createSession,
  deleteManySessions,
  deleteSession,
  findManySessions,
  findOneSession,
  updateSession,
} from './sessionStore.ts';
import {
  countVerifications,
  createVerification,
  deleteManyVerifications,
  deleteVerification,
  findManyVerifications,
  findOneVerification,
  updateVerification,
} from './verificationStore.ts';
import type { AdapterWhere } from './sqlWhere.ts';

/**
 * The better-auth ↔ event-sourced + crypto-shred adapter
 * (notes/auth-architecture.md). `user`/`account` are event-sourced with
 * crypto-shredding; `session`/`verification` are plain Postgres tables.
 *
 * Every place better-auth's mutable-CRUD model fights our append-only ES store
 * is handled here: update→command, delete(user)→THE SHRED, findOne(email)→blind
 * index, etc. We translate ONLY the simple `eq`/`in` id/email/userId/
 * providerId where-shapes better-auth actually issues and throw on anything else
 * — a silent miss would be an auth bug.
 *
 * Node-safe (`node:crypto`, `pg`) so testcontainers-on-Node integration passes.
 */

// --- where helpers -------------------------------------------------------

type CleanedWhere = {
  field: string;
  value: unknown;
  operator: string;
  connector: 'AND' | 'OR';
};

/** Value of a simple `eq` on `field`, or undefined if not present as an eq. */
const eqValue = (where: CleanedWhere[], field: string): unknown => {
  const w = where.find((c) => c.field === field && (c.operator ?? 'eq') === 'eq');
  return w?.value;
};

const asString = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : undefined;

const unsupported = (model: string, where: CleanedWhere[]): never => {
  throw new Error(
    `Unsupported where on '${model}': ${JSON.stringify(
      where.map((w) => ({ field: w.field, operator: w.operator })),
    )}`,
  );
};

// --- direct pg helpers (index lookups + counts) --------------------------

type Queryable = Pick<pg.Client, 'query'>;

const withClient = async <T>(fn: (c: Queryable) => Promise<T>): Promise<T> => {
  const client = new pg.Client({ connectionString: defaultConnectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
};

const userIdByEmailHash = (emailHash: string): Promise<string | null> =>
  withClient(async (c) => {
    const res = await c.query<{ user_id: string }>(
      'SELECT user_id FROM auth_user_email_index WHERE email_hash = $1',
      [emailHash],
    );
    return res.rows[0]?.user_id ?? null;
  });

const accountIdByProvider = (
  providerId: string,
  providerAccountId: string,
): Promise<string | null> =>
  withClient(async (c) => {
    const res = await c.query<{ account_id: string }>(
      `SELECT account_id FROM auth_account_index
       WHERE provider_id = $1 AND provider_account_id = $2`,
      [providerId, providerAccountId],
    );
    return res.rows[0]?.account_id ?? null;
  });

const accountIdsByUserId = (userId: string): Promise<string[]> =>
  withClient(async (c) => {
    const res = await c.query<{ account_id: string }>(
      'SELECT account_id FROM auth_account_index WHERE user_id = $1',
      [userId],
    );
    return res.rows.map((r) => r.account_id);
  });

const countTable = (table: string): Promise<number> =>
  withClient(async (c) => {
    const res = await c.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${table}`,
    );
    return Number(res.rows[0]?.count ?? 0);
  });

/**
 * Free a user's blind-index + account-index rows DIRECTLY (not via the EraseUser
 * inline projection). Called during the shred so erasure completes — and the
 * email becomes re-registerable — even if the tombstone append later fails. The
 * EraseUser/EraseAccount projections will redo these DELETEs harmlessly.
 */
const freeAuthIndexes = (userId: string): Promise<void> =>
  withClient(async (c) => {
    await c.query('DELETE FROM auth_user_email_index WHERE user_id = $1', [userId]);
    await c.query('DELETE FROM auth_account_index WHERE user_id = $1', [userId]);
  });

// --- field encoding helpers ----------------------------------------------

const toIso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : new Date().toISOString();

const isoOrUndef = (v: unknown): string | null | undefined =>
  v === undefined ? undefined : v === null ? null : v instanceof Date ? v.toISOString() : String(v);

/** Pack better-auth account token fields into the JSON bundle (ISO timestamps). */
const buildTokens = (data: Record<string, unknown>): AccountTokens => ({
  accessToken: (data.accessToken as string | null | undefined) ?? null,
  refreshToken: (data.refreshToken as string | null | undefined) ?? null,
  idToken: (data.idToken as string | null | undefined) ?? null,
  accessTokenExpiresAt: isoOrUndef(data.accessTokenExpiresAt) ?? null,
  refreshTokenExpiresAt: isoOrUndef(data.refreshTokenExpiresAt) ?? null,
  scope: (data.scope as string | null | undefined) ?? null,
});

const hasAnyToken = (data: Record<string, unknown>): boolean =>
  ['accessToken', 'refreshToken', 'idToken', 'accessTokenExpiresAt', 'refreshTokenExpiresAt', 'scope'].some(
    (k) => data[k] !== undefined,
  );

// --- user model ----------------------------------------------------------

const createUser = async (
  eventStore: AppEventStore,
  data: Record<string, unknown>,
): Promise<PlainUser> => {
  const userId = asString(data.id);
  if (!userId) throw new Error('user.create requires an id');
  const email = String(data.email ?? '');
  const name = String(data.name ?? '');
  const image = data.image == null ? undefined : String(data.image);
  const emailVerified = Boolean(data.emailVerified);
  const createdAt = toIso(data.createdAt);
  const updatedAt = toIso(data.updatedAt ?? data.createdAt);

  const dek = generateDek();
  // Key row first: the read path needs it. If the append then fails (duplicate
  // email → email_hash PK), we compensate by deleting the orphan key.
  await putWrappedDek(userId, wrapDek(dek));
  try {
    const command: UserCommand = {
      type: 'RegisterUser',
      data: {
        userId,
        emailCipher: encrypt(dek, email),
        nameCipher: encrypt(dek, name),
        imageCipher: image !== undefined ? encrypt(dek, image) : undefined,
        emailHash: emailBlindIndex(email),
        emailVerified,
        createdAt,
        updatedAt,
      },
    };
    await handleUser(eventStore, userId, (state) => decideUser(command, state));
  } catch (error) {
    await deleteDek(userId); // compensate: failed signup leaves no orphan key
    throw error;
  }

  return {
    id: userId,
    email,
    name,
    image: image ?? null,
    emailVerified,
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
  };
};

const findUser = async (
  eventStore: AppEventStore,
  where: CleanedWhere[],
): Promise<PlainUser | null> => {
  const id = asString(eqValue(where, 'id'));
  if (id) return readUser(eventStore, id);

  const email = asString(eqValue(where, 'email'));
  if (email !== undefined) {
    const userId = await userIdByEmailHash(emailBlindIndex(email));
    return userId ? readUser(eventStore, userId) : null;
  }
  return unsupported('user', where);
};

const updateUser = async (
  eventStore: AppEventStore,
  where: CleanedWhere[],
  update: Record<string, unknown>,
): Promise<PlainUser | null> => {
  const current = await findUser(eventStore, where);
  if (!current) return null;
  const userId = current.id;

  const wrapped = await getWrappedDek(userId);
  if (!wrapped) return null;
  const dek = unwrapDek(wrapped);
  const updatedAt = toIso(update.updatedAt ?? new Date());

  const commands: UserCommand[] = [];
  if ('name' in update || 'image' in update) {
    commands.push({
      type: 'UpdateUserProfile',
      data: {
        userId,
        nameCipher: 'name' in update ? encrypt(dek, String(update.name)) : undefined,
        imageCipher:
          'image' in update && update.image != null
            ? encrypt(dek, String(update.image))
            : undefined,
        updatedAt,
      },
    });
  }
  if ('email' in update) {
    const email = String(update.email);
    commands.push({
      type: 'ChangeUserEmail',
      data: { userId, emailCipher: encrypt(dek, email), emailHash: emailBlindIndex(email), updatedAt },
    });
  }
  if ('emailVerified' in update) {
    commands.push({
      type: 'SetUserEmailVerified',
      data: { userId, emailVerified: Boolean(update.emailVerified), updatedAt },
    });
  }

  for (const command of commands)
    await handleUser(eventStore, userId, (state) => decideUser(command, state));

  return readUser(eventStore, userId);
};

/**
 * THE SHRED. Irreversible. Order: DEK first (the actual erasure), then mark the
 * log + free the indexes, then drop sessions. After step 1 the user's + their
 * accounts' ciphertext is permanently unreadable even if 2–4 partially fail.
 */
const shredUser = async (
  eventStore: AppEventStore,
  where: CleanedWhere[],
): Promise<void> => {
  const userId = asString(eqValue(where, 'id'));
  if (!userId) return void unsupported('user', where);

  // Collect account ids BEFORE the index rows are removed.
  const accountIds = await accountIdsByUserId(userId);

  // 1. THE SHRED — delete the DEK row. All ciphertext now unrecoverable.
  await deleteDek(userId);

  // 1b. Free the index rows directly, so re-registration of this email works
  //     and no dangling user_id survives even if the tombstone appends below
  //     fail. Independent of the EraseUser projection (which would also free
  //     them, but only on a successful append).
  await freeAuthIndexes(userId);

  // 2. Mark erasure in the log (audit tombstone). The indexes are already freed
  //    above, so swallowing an append error here cannot strand an index row.
  const erasedAt = new Date().toISOString();
  try {
    await handleUser(eventStore, userId, (state) =>
      decideUser({ type: 'EraseUser', data: { userId, erasedAt } }, state),
    );
  } catch {
    /* already erased / never existed — key is already gone, safe to ignore */
  }

  // 3. Erase each account stream + free the account index rows.
  for (const accountId of accountIds) {
    try {
      await handleAccount(eventStore, accountId, (state) =>
        decideAccount({ type: 'EraseAccount', data: { accountId, erasedAt } }, state),
      );
    } catch {
      /* already erased — ignore */
    }
  }

  // 4. Drop the user's sessions (plain rows, genuinely gone).
  await deleteManySessions([{ field: 'userId', value: userId }]);
};

// --- account model -------------------------------------------------------

const ownerDek = async (userId: string) => {
  const wrapped = await getWrappedDek(userId);
  if (!wrapped) return null;
  return unwrapDek(wrapped);
};

const createAccount = async (
  eventStore: AppEventStore,
  data: Record<string, unknown>,
): Promise<PlainAccount> => {
  const accountId = asString(data.id);
  if (!accountId) throw new Error('account.create requires an id');
  const userId = String(data.userId ?? '');
  const providerId = String(data.providerId ?? '');
  const providerAccountId = String(data.accountId ?? '');
  const password = data.password == null ? undefined : String(data.password);
  const createdAt = toIso(data.createdAt);
  const updatedAt = toIso(data.updatedAt ?? data.createdAt);

  const dek = await ownerDek(userId);
  if (!dek) throw new Error(`account.create: owner DEK missing for user ${userId}`);

  const command: AccountCommand = {
    type: 'LinkAccount',
    data: {
      accountId,
      userId,
      providerId,
      providerAccountId,
      providerAccountIdCipher: encrypt(dek, providerAccountId),
      passwordCipher: password !== undefined ? encrypt(dek, password) : undefined,
      tokensCipher: hasAnyToken(data) ? encryptJson(dek, buildTokens(data)) : undefined,
      createdAt,
      updatedAt,
    },
  };
  await handleAccount(eventStore, accountId, (state) => decideAccount(command, state));

  const account = await readAccount(eventStore, accountId);
  if (!account) throw new Error('account.create: account vanished after link');
  return account;
};

const findAccount = async (
  eventStore: AppEventStore,
  where: CleanedWhere[],
): Promise<PlainAccount | null> => {
  const id = asString(eqValue(where, 'id'));
  if (id) return readAccount(eventStore, id);

  const providerId = asString(eqValue(where, 'providerId'));
  const providerAccountId = asString(eqValue(where, 'accountId'));
  if (providerId && providerAccountId) {
    const accountId = await accountIdByProvider(providerId, providerAccountId);
    return accountId ? readAccount(eventStore, accountId) : null;
  }

  const userId = asString(eqValue(where, 'userId'));
  if (userId) {
    const ids = await accountIdsByUserId(userId);
    if (ids.length === 0) return null;
    return readAccount(eventStore, ids[0]!);
  }
  return unsupported('account', where);
};

const findAccounts = async (
  eventStore: AppEventStore,
  where: CleanedWhere[] | undefined,
): Promise<PlainAccount[]> => {
  const userId = where ? asString(eqValue(where, 'userId')) : undefined;
  if (userId) {
    const ids = await accountIdsByUserId(userId);
    const accounts = await Promise.all(ids.map((id) => readAccount(eventStore, id)));
    return accounts.filter((a): a is PlainAccount => a !== null);
  }
  const id = where ? asString(eqValue(where, 'id')) : undefined;
  if (id) {
    const a = await readAccount(eventStore, id);
    return a ? [a] : [];
  }
  return unsupported('account', where ?? []);
};

const updateAccount = async (
  eventStore: AppEventStore,
  where: CleanedWhere[],
  update: Record<string, unknown>,
): Promise<PlainAccount | null> => {
  const current = await findAccount(eventStore, where);
  if (!current) return null;
  const accountId = current.id;

  const dek = await ownerDek(current.userId);
  if (!dek) return null;
  const updatedAt = toIso(update.updatedAt ?? new Date());

  const command: AccountCommand = {
    type: 'ChangeAccountCredentials',
    data: {
      accountId,
      passwordCipher: 'password' in update ? encrypt(dek, String(update.password)) : undefined,
      tokensCipher: hasAnyToken(update)
        ? encryptJson(dek, buildTokens({ ...current, ...update }))
        : undefined,
      updatedAt,
    },
  };
  await handleAccount(eventStore, accountId, (state) => decideAccount(command, state));
  return readAccount(eventStore, accountId);
};

// --- factory -------------------------------------------------------------

/**
 * Build the better-auth adapter factory bound to an event store. `auth.ts`
 * calls `esCryptoAdapter(eventStore)` and passes the result as `database`.
 */
export const esCryptoAdapter = (eventStore: AppEventStore) =>
  createAdapterFactory({
    config: {
      adapterId: 'event-sourced-crypto',
      adapterName: 'ES + crypto-shred adapter',
      supportsJSON: false, // we hand-encrypt; BA must not assume JSON columns
      supportsDates: true,
      supportsBooleans: true,
      supportsNumericIds: false, // ids are strings (stream keys)
      disableIdGeneration: false, // BA generates ids; we use them as stream keys
    },
    adapter: () => ({
      create: async ({ model, data }) => {
        switch (model) {
          case 'user':
            return (await createUser(eventStore, data)) as never;
          case 'account':
            return (await createAccount(eventStore, data)) as never;
          case 'session':
            return (await createSession(data)) as never;
          case 'verification':
            return (await createVerification(data)) as never;
          default:
            throw new Error(`create: unknown model '${model}'`);
        }
      },
      findOne: async ({ model, where }) => {
        const w = where as CleanedWhere[];
        switch (model) {
          case 'user':
            return (await findUser(eventStore, w)) as never;
          case 'account':
            return (await findAccount(eventStore, w)) as never;
          case 'session':
            return (await findOneSession(w as AdapterWhere[])) as never;
          case 'verification':
            return (await findOneVerification(w as AdapterWhere[])) as never;
          default:
            throw new Error(`findOne: unknown model '${model}'`);
        }
      },
      findMany: async ({ model, where, limit, offset, sortBy }) => {
        const w = where as CleanedWhere[] | undefined;
        switch (model) {
          case 'account':
            return (await findAccounts(eventStore, w)) as never;
          case 'session':
            return (await findManySessions(w as AdapterWhere[] | undefined, {
              limit,
              offset,
              sortBy,
            })) as never;
          case 'verification':
            return (await findManyVerifications(w as AdapterWhere[] | undefined, {
              limit,
              offset,
              sortBy,
            })) as never;
          case 'user':
            // BA does not issue user findMany in the email/password flow.
            return unsupported('user', w ?? []) as never;
          default:
            throw new Error(`findMany: unknown model '${model}'`);
        }
      },
      update: async ({ model, where, update }) => {
        const w = where as CleanedWhere[];
        switch (model) {
          case 'user':
            return (await updateUser(eventStore, w, update as Record<string, unknown>)) as never;
          case 'account':
            return (await updateAccount(eventStore, w, update as Record<string, unknown>)) as never;
          case 'session':
            return (await updateSession(w as AdapterWhere[], update as Record<string, unknown>)) as never;
          case 'verification':
            return (await updateVerification(
              w as AdapterWhere[],
              update as Record<string, unknown>,
            )) as never;
          default:
            throw new Error(`update: unknown model '${model}'`);
        }
      },
      updateMany: async ({ model, where, update }) => {
        // BA issues updateMany only on plain tables in our flows.
        const w = where as AdapterWhere[];
        switch (model) {
          case 'session': {
            await updateSession(w, update as Record<string, unknown>);
            return 1;
          }
          case 'verification': {
            await updateVerification(w, update as Record<string, unknown>);
            return 1;
          }
          default:
            throw new Error(`updateMany unsupported on model '${model}'`);
        }
      },
      delete: async ({ model, where }) => {
        const w = where as CleanedWhere[];
        switch (model) {
          case 'user':
            return void (await shredUser(eventStore, w)); // THE SHRED
          case 'account': {
            const a = await findAccount(eventStore, w);
            if (a)
              await handleAccount(eventStore, a.id, (state) =>
                decideAccount(
                  { type: 'EraseAccount', data: { accountId: a.id, erasedAt: new Date().toISOString() } },
                  state,
                ),
              );
            return;
          }
          case 'session':
            return deleteSession(w as AdapterWhere[]);
          case 'verification':
            return deleteVerification(w as AdapterWhere[]);
          default:
            throw new Error(`delete: unknown model '${model}'`);
        }
      },
      deleteMany: async ({ model, where }) => {
        const w = where as AdapterWhere[];
        switch (model) {
          case 'session':
            return deleteManySessions(w);
          case 'verification':
            return deleteManyVerifications(w);
          default:
            throw new Error(`deleteMany unsupported on model '${model}'`);
        }
      },
      count: async ({ model, where }) => {
        switch (model) {
          case 'user':
            return countTable('auth_user_email_index');
          case 'account':
            return countTable('auth_account_index');
          case 'session':
            return countSessions(where as AdapterWhere[] | undefined);
          case 'verification':
            return countVerifications(where as AdapterWhere[] | undefined);
          default:
            throw new Error(`count: unknown model '${model}'`);
        }
      },
    }),
  });
