import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { Cipher } from '../../auth/crypto.ts';
import type { AccountEvent } from './events.ts';

/**
 * Decider for a single auth-account stream. Within-stream invariants only
 * (can't link twice, can't change/erase after erase). The adapter encrypts
 * secrets under the owner's DEK BEFORE issuing a command; the decider carries
 * opaque ciphertext + non-secret plaintext (userId/providerId).
 *
 * Cross-aggregate `(providerId, providerAccountId)` uniqueness is enforced by
 * the inline `auth_account_index` constraint, not here (§2.5).
 */

// --- State ---------------------------------------------------------------

export type Account =
  | { status: 'empty' }
  | { status: 'active'; accountId: string }
  | { status: 'erased'; accountId: string };

export const initialState = (): Account => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type LinkAccount = Command<
  'LinkAccount',
  {
    accountId: string;
    userId: string;
    providerId: string;
    providerAccountId: string;
    providerAccountIdCipher: Cipher;
    passwordCipher?: Cipher;
    tokensCipher?: Cipher;
    createdAt: string;
    updatedAt: string;
  }
>;

export type ChangeAccountCredentials = Command<
  'ChangeAccountCredentials',
  { accountId: string; passwordCipher?: Cipher; tokensCipher?: Cipher; updatedAt: string }
>;

export type EraseAccount = Command<
  'EraseAccount',
  { accountId: string; erasedAt: string }
>;

export type AccountCommand =
  | LinkAccount
  | ChangeAccountCredentials
  | EraseAccount;

// --- Decide --------------------------------------------------------------

export const decide = (command: AccountCommand, state: Account): AccountEvent => {
  switch (command.type) {
    case 'LinkAccount': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Account already linked');
      return { type: 'AccountLinked', data: command.data };
    }
    case 'ChangeAccountCredentials': {
      if (state.status !== 'active')
        throw new IllegalStateError('Cannot change credentials of a non-active account');
      return { type: 'AccountCredentialsChanged', data: command.data };
    }
    case 'EraseAccount': {
      if (state.status !== 'active')
        throw new IllegalStateError('Cannot erase a non-active account');
      return { type: 'AccountErased', data: command.data };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: Account, event: AccountEvent): Account => {
  switch (event.type) {
    case 'AccountLinked':
      return { status: 'active', accountId: event.data.accountId };
    case 'AccountCredentialsChanged':
      return state;
    case 'AccountErased':
      return { status: 'erased', accountId: event.data.accountId };
  }
};
