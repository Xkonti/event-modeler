import type { AppEventStore } from '../eventStore.ts';
import { accountStreamId } from '../shared/streams.ts';
import type { Cipher } from './crypto.ts';
import { decrypt, decryptJson, unwrapDek } from './crypto.ts';
import { getWrappedDek } from './keystore.ts';
import type { AccountEvent } from '../domain/account/events.ts';

/** The OAuth token bundle packed into one encrypted JSON blob (tokensCipher). */
export type AccountTokens = {
  accessToken?: string | null;
  refreshToken?: string | null;
  idToken?: string | null;
  accessTokenExpiresAt?: string | null; // ISO; rehydrated to Date for better-auth
  refreshTokenExpiresAt?: string | null;
  scope?: string | null;
};

/**
 * The decrypted account better-auth expects back. Mirrors better-auth's
 * `account` model. Token timestamps are Dates (rehydrated from the ISO strings
 * stored in the JSON blob).
 */
export type PlainAccount = {
  id: string;
  accountId: string; // provider-side id
  providerId: string;
  userId: string;
  password: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AccountCiphers = {
  exists: boolean;
  erased: boolean;
  userId: string;
  providerId: string;
  providerAccountIdCipher?: Cipher;
  passwordCipher?: Cipher;
  tokensCipher?: Cipher;
  createdAt: string;
  updatedAt: string;
};

const initial = (): AccountCiphers => ({
  exists: false,
  erased: false,
  userId: '',
  providerId: '',
  createdAt: '',
  updatedAt: '',
});

const fold = (state: AccountCiphers, event: AccountEvent): AccountCiphers => {
  switch (event.type) {
    case 'AccountLinked':
      return {
        exists: true,
        erased: false,
        userId: event.data.userId,
        providerId: event.data.providerId,
        providerAccountIdCipher: event.data.providerAccountIdCipher,
        passwordCipher: event.data.passwordCipher,
        tokensCipher: event.data.tokensCipher,
        createdAt: event.data.createdAt,
        updatedAt: event.data.updatedAt,
      };
    case 'AccountCredentialsChanged':
      return {
        ...state,
        passwordCipher: event.data.passwordCipher ?? state.passwordCipher,
        tokensCipher: event.data.tokensCipher ?? state.tokensCipher,
        updatedAt: event.data.updatedAt,
      };
    case 'AccountErased':
      return { ...state, erased: true };
  }
};

const toDate = (v?: string | null): Date | null => (v ? new Date(v) : null);

/**
 * Reconstruct a decrypted account by id, or `null` if it does not exist, was
 * erased, or its owner's DEK is gone (shredded). The account is encrypted with
 * the OWNING user's DEK — loaded via `auth_user_keys` by the `userId` folded off
 * the stream (notes/auth-architecture.md §1.3, §3.4).
 */
export const readAccount = async (
  eventStore: AppEventStore,
  accountId: string,
  connectionString?: string,
): Promise<PlainAccount | null> => {
  const { state } = await eventStore.aggregateStream<AccountCiphers, AccountEvent>(
    accountStreamId(accountId),
    { evolve: fold, initialState: initial },
  );
  if (!state.exists || state.erased) return null;

  const wrapped = await getWrappedDek(state.userId, { connectionString });
  if (!wrapped) return null; // owner shredded
  const dek = unwrapDek(wrapped);

  const tokens: AccountTokens = state.tokensCipher
    ? decryptJson<AccountTokens>(dek, state.tokensCipher)
    : {};

  return {
    id: accountId,
    accountId: state.providerAccountIdCipher
      ? decrypt(dek, state.providerAccountIdCipher)
      : '',
    providerId: state.providerId,
    userId: state.userId,
    password: state.passwordCipher ? decrypt(dek, state.passwordCipher) : null,
    accessToken: tokens.accessToken ?? null,
    refreshToken: tokens.refreshToken ?? null,
    idToken: tokens.idToken ?? null,
    accessTokenExpiresAt: toDate(tokens.accessTokenExpiresAt),
    refreshTokenExpiresAt: toDate(tokens.refreshTokenExpiresAt),
    scope: tokens.scope ?? null,
    createdAt: new Date(state.createdAt),
    updatedAt: new Date(state.updatedAt),
  };
};
