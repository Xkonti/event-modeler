import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import type { Cipher } from '../../auth/crypto.ts';
import { decide, evolve, initialState } from './account.ts';

/**
 * Decider unit tests — pure GIVEN/WHEN/THEN, no DB. Exercises within-stream
 * invariants (no double-link, no change/erase after erase). Ciphers are opaque
 * fixtures.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const cipher = (tag: string): Cipher => ({ iv: tag, authTag: tag, ct: tag });

const linked = {
  type: 'AccountLinked' as const,
  data: {
    accountId: 'a1',
    userId: 'u1',
    providerId: 'credential',
    providerAccountId: 'u1',
    providerAccountIdCipher: cipher('pid'),
    passwordCipher: cipher('pw'),
    createdAt: '2026-06-06T00:00:00.000Z',
    updatedAt: '2026-06-06T00:00:00.000Z',
  },
};

describe('account decider', () => {
  it('links an account from empty', () => {
    given([])
      .when({ type: 'LinkAccount', data: linked.data })
      .then([linked]);
  });

  it('rejects re-linking an existing account', () => {
    given([linked])
      .when({ type: 'LinkAccount', data: linked.data })
      .thenThrows();
  });

  it('changes credentials of an active account', () => {
    given([linked])
      .when({
        type: 'ChangeAccountCredentials',
        data: { accountId: 'a1', passwordCipher: cipher('pw2'), updatedAt: 't' },
      })
      .then([
        {
          type: 'AccountCredentialsChanged',
          data: { accountId: 'a1', passwordCipher: cipher('pw2'), updatedAt: 't' },
        },
      ]);
  });

  it('erases an active account', () => {
    given([linked])
      .when({ type: 'EraseAccount', data: { accountId: 'a1', erasedAt: 't' } })
      .then([{ type: 'AccountErased', data: { accountId: 'a1', erasedAt: 't' } }]);
  });

  it('rejects changing credentials of an erased account', () => {
    given([linked, { type: 'AccountErased', data: { accountId: 'a1', erasedAt: 't' } }])
      .when({
        type: 'ChangeAccountCredentials',
        data: { accountId: 'a1', passwordCipher: cipher('x'), updatedAt: 't' },
      })
      .thenThrows();
  });

  it('rejects erasing an already-erased account', () => {
    given([linked, { type: 'AccountErased', data: { accountId: 'a1', erasedAt: 't' } }])
      .when({ type: 'EraseAccount', data: { accountId: 'a1', erasedAt: 't2' } })
      .thenThrows();
  });
});
