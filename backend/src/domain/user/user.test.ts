import { describe, it } from 'bun:test';
import { DeciderSpecification } from '@event-driven-io/emmett';
import type { Cipher } from '../../auth/crypto.ts';
import { decide, evolve, initialState } from './user.ts';

/**
 * Decider unit tests — pure GIVEN events / WHEN command / THEN events, no DB.
 * Exercises the within-stream invariants the decider owns (no double-register,
 * no edit/erase after erase). Ciphers are opaque fixtures; the decider never
 * decrypts.
 */
const given = DeciderSpecification.for({ decide, evolve, initialState });

const cipher = (tag: string): Cipher => ({ iv: tag, authTag: tag, ct: tag });

const registered = {
  type: 'UserRegistered' as const,
  data: {
    userId: 'u1',
    emailCipher: cipher('e'),
    nameCipher: cipher('n'),
    emailHash: 'hash1',
    emailVerified: false,
    createdAt: '2026-06-06T00:00:00.000Z',
    updatedAt: '2026-06-06T00:00:00.000Z',
  },
};

describe('user decider', () => {
  it('registers a user from empty', () => {
    given([])
      .when({ type: 'RegisterUser', data: registered.data })
      .then([registered]);
  });

  it('rejects re-registering an existing user', () => {
    given([registered])
      .when({ type: 'RegisterUser', data: registered.data })
      .thenThrows();
  });

  it('updates the profile of an active user', () => {
    given([registered])
      .when({
        type: 'UpdateUserProfile',
        data: { userId: 'u1', nameCipher: cipher('n2'), updatedAt: 't' },
      })
      .then([
        {
          type: 'UserProfileUpdated',
          data: { userId: 'u1', nameCipher: cipher('n2'), imageCipher: undefined, updatedAt: 't' },
        },
      ]);
  });

  it('changes the email of an active user', () => {
    given([registered])
      .when({
        type: 'ChangeUserEmail',
        data: { userId: 'u1', emailCipher: cipher('e2'), emailHash: 'hash2', updatedAt: 't' },
      })
      .then([
        {
          type: 'UserEmailChanged',
          data: { userId: 'u1', emailCipher: cipher('e2'), emailHash: 'hash2', updatedAt: 't' },
        },
      ]);
  });

  it('sets email-verified on an active user', () => {
    given([registered])
      .when({
        type: 'SetUserEmailVerified',
        data: { userId: 'u1', emailVerified: true, updatedAt: 't' },
      })
      .then([
        {
          type: 'UserEmailVerifiedSet',
          data: { userId: 'u1', emailVerified: true, updatedAt: 't' },
        },
      ]);
  });

  it('erases an active user', () => {
    given([registered])
      .when({ type: 'EraseUser', data: { userId: 'u1', erasedAt: 't' } })
      .then([{ type: 'UserErased', data: { userId: 'u1', erasedAt: 't' } }]);
  });

  it('rejects editing an erased user', () => {
    given([registered, { type: 'UserErased', data: { userId: 'u1', erasedAt: 't' } }])
      .when({
        type: 'UpdateUserProfile',
        data: { userId: 'u1', nameCipher: cipher('x'), updatedAt: 't' },
      })
      .thenThrows();
  });

  it('rejects erasing an already-erased user', () => {
    given([registered, { type: 'UserErased', data: { userId: 'u1', erasedAt: 't' } }])
      .when({ type: 'EraseUser', data: { userId: 'u1', erasedAt: 't2' } })
      .thenThrows();
  });
});
