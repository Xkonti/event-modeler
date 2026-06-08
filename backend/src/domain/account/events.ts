import type { Event } from '@event-driven-io/emmett';
import type { Cipher } from '../../auth/crypto.ts';

/**
 * Auth account events. One stream per account row: `account-{accountId}` where
 * accountId = better-auth's `account.id` (PK), NOT the provider-side id.
 *
 * Secrets (`providerAccountId`, `password` hash, OAuth token bundle) live ONLY
 * in `*Cipher` blobs, encrypted with the OWNING USER's DEK (keyed by userId) —
 * one DEK per user shreds the user AND all their accounts in a single row delete
 * (notes/auth-architecture.md).
 *
 * Plaintext (not PII, must be filterable without a DEK):
 *  - `userId` — the FK better-auth queries accounts by.
 *  - `providerId` — `'credential'` / `'google'` / …; filtered by value.
 *  - `providerAccountId` (in the index table, NOT here) — for `credential` it
 *    equals userId, an opaque id; kept off the event but on the index row.
 *
 * `tokensCipher` packs the whole OAuth bundle ({accessToken, refreshToken,
 * idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope}) into ONE
 * encrypted JSON blob. `passwordCipher` is separate (changes on its own).
 */
export type AccountLinked = Event<
  'AccountLinked',
  {
    accountId: string;
    userId: string;
    providerId: string;
    providerAccountId: string; // plaintext id (NOT secret), also on the index row
    providerAccountIdCipher: Cipher;
    passwordCipher?: Cipher;
    tokensCipher?: Cipher;
    createdAt: string;
    updatedAt: string;
  }
>;

export type AccountCredentialsChanged = Event<
  'AccountCredentialsChanged',
  {
    accountId: string;
    passwordCipher?: Cipher; // only changed creds present
    tokensCipher?: Cipher;
    updatedAt: string;
  }
>;

/** Records the account erasure. Holds NO secret — the shred is the user DEK delete. */
export type AccountErased = Event<
  'AccountErased',
  { accountId: string; erasedAt: string }
>;

export type AccountEvent =
  | AccountLinked
  | AccountCredentialsChanged
  | AccountErased;
