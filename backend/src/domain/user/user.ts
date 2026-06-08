import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { Cipher } from '../../auth/crypto.ts';
import type { UserEvent } from './events.ts';

/**
 * Decider for a single auth-user stream. Enforces ONLY within-stream invariants
 * (can't register twice, can't edit/erase after erase). It never sees plaintext:
 * the adapter encrypts PII into `*Cipher` blobs and computes `emailHash` BEFORE
 * issuing a command, so the decider just carries opaque ciphertext + the
 * non-PII plaintext through to events.
 *
 * Cross-aggregate email uniqueness is NOT decided here (a decider sees one
 * stream) — the inline `auth_user_email_index` constraint enforces it in the
 * append tx (notes/auth-architecture.md).
 */

// --- State ---------------------------------------------------------------

export type User =
  | { status: 'empty' }
  | { status: 'active'; userId: string }
  | { status: 'erased'; userId: string };

export const initialState = (): User => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type RegisterUser = Command<
  'RegisterUser',
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

export type UpdateUserProfile = Command<
  'UpdateUserProfile',
  { userId: string; nameCipher?: Cipher; imageCipher?: Cipher; updatedAt: string }
>;

export type ChangeUserEmail = Command<
  'ChangeUserEmail',
  { userId: string; emailCipher: Cipher; emailHash: string; updatedAt: string }
>;

export type SetUserEmailVerified = Command<
  'SetUserEmailVerified',
  { userId: string; emailVerified: boolean; updatedAt: string }
>;

export type EraseUser = Command<'EraseUser', { userId: string; erasedAt: string }>;

export type UserCommand =
  | RegisterUser
  | UpdateUserProfile
  | ChangeUserEmail
  | SetUserEmailVerified
  | EraseUser;

// --- Decide --------------------------------------------------------------

export const decide = (command: UserCommand, state: User): UserEvent => {
  switch (command.type) {
    case 'RegisterUser': {
      if (state.status !== 'empty')
        throw new IllegalStateError('User already registered');
      return { type: 'UserRegistered', data: command.data };
    }
    case 'UpdateUserProfile': {
      if (state.status !== 'active')
        throw new IllegalStateError('Cannot update a non-active user');
      const { userId, nameCipher, imageCipher, updatedAt } = command.data;
      return {
        type: 'UserProfileUpdated',
        data: { userId, nameCipher, imageCipher, updatedAt },
      };
    }
    case 'ChangeUserEmail': {
      if (state.status !== 'active')
        throw new IllegalStateError('Cannot change email of a non-active user');
      return { type: 'UserEmailChanged', data: command.data };
    }
    case 'SetUserEmailVerified': {
      if (state.status !== 'active')
        throw new IllegalStateError('Cannot set verification on a non-active user');
      return { type: 'UserEmailVerifiedSet', data: command.data };
    }
    case 'EraseUser': {
      // Idempotent: erasing an already-erased user is a no-op marker. But the
      // adapter's shred path appends only against an active user; re-erase would
      // hit this guard. Treat double-erase as illegal to surface logic errors.
      if (state.status !== 'active')
        throw new IllegalStateError('Cannot erase a non-active user');
      return { type: 'UserErased', data: command.data };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: User, event: UserEvent): User => {
  switch (event.type) {
    case 'UserRegistered':
      return { status: 'active', userId: event.data.userId };
    case 'UserProfileUpdated':
    case 'UserEmailChanged':
    case 'UserEmailVerifiedSet':
      return state;
    case 'UserErased':
      return { status: 'erased', userId: event.data.userId };
  }
};
