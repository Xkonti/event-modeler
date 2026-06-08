import type { Event } from '@event-driven-io/emmett';
import type { Cipher } from '../../auth/crypto.ts';

/**
 * Auth user events. One stream per user: `user-{userId}`.
 *
 * PII (`email`, `name`, `image`) lives ONLY in the `*Cipher` ciphertext blobs —
 * encrypted with that user's DEK (notes/auth-architecture.md). NOTHING in
 * an event reconstructs PII without the DEK row in `auth_user_keys`; deleting
 * that row is the crypto-shred.
 *
 * Plaintext fields (`userId`, `emailHash`, `emailVerified`, `createdAt`,
 * `updatedAt`, `erasedAt`) are NOT PII:
 *  - `emailHash` is the non-reversible blind index (hex HMAC-SHA256), the ONE
 *    derived-from-email value allowed at rest. The adapter computes it before
 *    append; the inline SQL constraint can't HMAC, so it reads it off the event.
 *  - `emailVerified` is a boolean; timestamps are needed even post-shred (audit,
 *    count) and require no DEK.
 */
export type UserRegistered = Event<
  'UserRegistered',
  {
    userId: string;
    emailCipher: Cipher;
    nameCipher: Cipher;
    imageCipher?: Cipher;
    emailHash: string;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
  }
>;

export type UserProfileUpdated = Event<
  'UserProfileUpdated',
  {
    userId: string;
    nameCipher?: Cipher; // only changed fields present
    imageCipher?: Cipher;
    updatedAt: string;
  }
>;

export type UserEmailChanged = Event<
  'UserEmailChanged',
  {
    userId: string;
    emailCipher: Cipher;
    emailHash: string; // new blind index; inline constraint swaps old→new
    updatedAt: string;
  }
>;

export type UserEmailVerifiedSet = Event<
  'UserEmailVerifiedSet',
  { userId: string; emailVerified: boolean; updatedAt: string }
>;

/** Records the erasure happened. Holds NO PII — the shred is the DEK delete. */
export type UserErased = Event<'UserErased', { userId: string; erasedAt: string }>;

export type UserEvent =
  | UserRegistered
  | UserProfileUpdated
  | UserEmailChanged
  | UserEmailVerifiedSet
  | UserErased;
