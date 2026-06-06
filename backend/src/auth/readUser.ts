import type { AppEventStore } from '../eventStore.ts';
import { userStreamId } from '../shared/streams.ts';
import type { Cipher } from './crypto.ts';
import { decrypt, unwrapDek } from './crypto.ts';
import { getWrappedDek } from './keystore.ts';
import type { UserEvent } from '../domain/user/events.ts';

/**
 * The decrypted user better-auth expects back from the adapter. Mirrors
 * better-auth's `user` model (id/email/name/image/emailVerified/createdAt/
 * updatedAt). `image` may be null.
 */
export type PlainUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Folded ciphertext view of a user stream — the latest cipher per PII field plus
 * plaintext metadata. `erased` short-circuits to null at the read boundary.
 */
type UserCiphers = {
  exists: boolean;
  erased: boolean;
  emailCipher?: Cipher;
  nameCipher?: Cipher;
  imageCipher?: Cipher;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

const initial = (): UserCiphers => ({
  exists: false,
  erased: false,
  emailVerified: false,
  createdAt: '',
  updatedAt: '',
});

const fold = (state: UserCiphers, event: UserEvent): UserCiphers => {
  switch (event.type) {
    case 'UserRegistered':
      return {
        exists: true,
        erased: false,
        emailCipher: event.data.emailCipher,
        nameCipher: event.data.nameCipher,
        imageCipher: event.data.imageCipher,
        emailVerified: event.data.emailVerified,
        createdAt: event.data.createdAt,
        updatedAt: event.data.updatedAt,
      };
    case 'UserProfileUpdated':
      return {
        ...state,
        nameCipher: event.data.nameCipher ?? state.nameCipher,
        imageCipher: event.data.imageCipher ?? state.imageCipher,
        updatedAt: event.data.updatedAt,
      };
    case 'UserEmailChanged':
      return {
        ...state,
        emailCipher: event.data.emailCipher,
        updatedAt: event.data.updatedAt,
      };
    case 'UserEmailVerifiedSet':
      return {
        ...state,
        emailVerified: event.data.emailVerified,
        updatedAt: event.data.updatedAt,
      };
    case 'UserErased':
      return { ...state, erased: true };
  }
};

/**
 * Reconstruct a decrypted user by id, or `null` if the user does not exist, was
 * erased, or has been crypto-shredded (DEK row gone). Steps:
 *   1. Load the wrapped DEK — MISS → shredded → null (the post-shred guarantee).
 *   2. Fold the stream — no stream / erased → null.
 *   3. Unwrap DEK + decrypt each PII cipher.
 * Events remain in the log post-shred but are undecryptable ciphertext.
 */
export const readUser = async (
  eventStore: AppEventStore,
  userId: string,
  connectionString?: string,
): Promise<PlainUser | null> => {
  const wrapped = await getWrappedDek(userId, { connectionString });
  if (!wrapped) return null; // shredded or never existed

  const { state } = await eventStore.aggregateStream<UserCiphers, UserEvent>(
    userStreamId(userId),
    { evolve: fold, initialState: initial },
  );
  if (!state.exists || state.erased) return null;
  if (!state.emailCipher || !state.nameCipher) return null;

  const dek = unwrapDek(wrapped);
  return {
    id: userId,
    email: decrypt(dek, state.emailCipher),
    name: decrypt(dek, state.nameCipher),
    image: state.imageCipher ? decrypt(dek, state.imageCipher) : null,
    emailVerified: state.emailVerified,
    createdAt: new Date(state.createdAt),
    updatedAt: new Date(state.updatedAt),
  };
};
