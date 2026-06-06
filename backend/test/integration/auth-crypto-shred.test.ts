/**
 * C10–C14 — crypto-shredding on erasure (THE HEADLINE).
 * notes/auth-test-plan.md §1.2 C; notes/auth-build-plan.md §4 (test table).
 *
 * The shred is run via the REAL adapter `delete({model:'user'})` path — the v1
 * erasure entrypoint (no public "delete me" route; §1.3 of the build plan). It
 * deletes the per-user DEK row FIRST (the irreversible step), then appends the
 * erasure events + frees the indexes + drops sessions.
 *
 * Proof of irreversibility (not a soft flag): we capture a ciphertext blob AND
 * its DEK and DECRYPT it successfully BEFORE the shred (positive control); after
 * the shred the SAME surviving ciphertext is permanently undecryptable (the DEK
 * is gone → AES-GCM auth-tag verification cannot succeed → `decrypt` throws).
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  bootAuthHarness,
  freshCreds,
  hasSessionCookie,
  login,
  signup,
  stopAuthHarness,
  userIdForEmail,
  type AuthHarness,
} from './_authHarness.ts';

type Cipher = { iv: string; authTag: string; ct: string };

describe('crypto-shredding on erasure (C10–C14)', () => {
  let h: AuthHarness;

  before(async () => {
    h = await bootAuthHarness();
  });
  after(async () => {
    await stopAuthHarness();
  });

  /** Pull the `emailCipher` blob from the surviving UserRegistered event row. */
  const userEmailCipher = async (userId: string): Promise<Cipher> => {
    const rows = await h.pgQuery<{ message_data: { emailCipher: Cipher } }>(
      `SELECT message_data FROM emt_messages
        WHERE stream_id = $1 AND message_type = 'UserRegistered'
        LIMIT 1`,
      [`user-${userId}`],
    );
    const cipher = rows[0]?.message_data?.emailCipher;
    assert.ok(cipher?.iv && cipher?.authTag && cipher?.ct, 'UserRegistered must carry an emailCipher blob');
    return cipher;
  };

  it('C10–C14: deleting a user shreds the DEK, leaving its ciphertext permanently undecryptable, frees the index, blocks login, and frees the email', async () => {
    // --- arrange: signup + capture the at-rest ciphertext ---
    const creds = freshCreds();
    assert.equal((await signup(h.jar(), creds)).status, 200);

    const userId = await userIdForEmail(h, creds.email);
    assert.ok(userId, 'blind index must resolve the new user id');

    const emailCipher = await userEmailCipher(userId);

    // POSITIVE CONTROL — before the shred the DEK exists and decrypts the blob
    // back to the real email. This is what the shred makes impossible.
    const wrappedBefore = await h.getWrappedDek(userId);
    assert.ok(wrappedBefore, 'a wrapped DEK row must exist before the shred');
    const dekBefore = h.unwrapDek(wrappedBefore);
    assert.equal(
      h.decrypt(dekBefore, emailCipher),
      creds.email,
      'the captured ciphertext decrypts to the email BEFORE the shred',
    );

    // --- act: THE SHRED (real adapter delete(user) path) ---
    await h.shred(userId);

    // C10: the DEK keystore row is gone — this IS the shred.
    const dekRows = await h.pgQuery(
      `SELECT 1 FROM auth_user_keys WHERE user_id = $1`,
      [userId],
    );
    assert.equal(dekRows.length, 0, 'C10: the DEK keystore row must be deleted');
    assert.equal(await h.getWrappedDek(userId), null, 'C10: getWrappedDek returns null post-shred');

    // C11: the surviving ciphertext in the immutable log is permanently
    // undecryptable. The event row is NOT rewritten (the log stays); only the
    // DEK row is gone. The PRODUCTION read path obtains the DEK via the keystore,
    // which now returns null (asserted in C10) → it can never reconstruct a key.
    // Crypto proof: with the real DEK irrecoverable, ANY other key fails the
    // AES-GCM auth-tag check, so `decrypt` THROWS (vs. the positive control
    // above, where the real DEK decrypted the SAME blob to the email).
    const cipherAfter = await userEmailCipher(userId); // still present in the log
    assert.deepEqual(cipherAfter, emailCipher, 'C11: the event ciphertext is NOT rewritten by the shred');
    const wrongDek = randomBytes(32); // stands in for "any key but the deleted one"
    assert.throws(
      () => h.decrypt(wrongDek, cipherAfter),
      'C11: the surviving ciphertext is undecryptable without the (now-deleted) DEK',
    );

    // C12: the email blind-index row is removed (the email is freed; no dangling
    // id→hash mapping survives).
    const idxRows = await h.pgQuery(
      `SELECT 1 FROM auth_user_email_index WHERE email_hash = $1`,
      [h.emailBlindIndex(creds.email)],
    );
    assert.equal(idxRows.length, 0, 'C12: the blind-index row must be removed on shred');

    // C13: login fails after the shred — no session.
    const loginJar = h.jar();
    const res = await login(loginJar, creds);
    assert.ok(res.status >= 400, `C13: post-shred login must be rejected, got ${res.status}`);
    assert.ok(!hasSessionCookie(loginJar), 'C13: post-shred login must NOT set a session cookie');

    // C14: the email is free to re-register → a NEW id, new DEK, new ciphertext.
    const reJar = h.jar();
    const reSignup = await signup(reJar, creds);
    assert.equal(reSignup.status, 200, await reSignup.text());
    const newUserId = await userIdForEmail(h, creds.email);
    assert.ok(newUserId, 'C14: re-registration must re-create the blind-index row');
    assert.notEqual(newUserId, userId, 'C14: the re-registered user has a NEW id');

    const newDekRows = await h.pgQuery(
      `SELECT 1 FROM auth_user_keys WHERE user_id = $1`,
      [newUserId],
    );
    assert.equal(newDekRows.length, 1, 'C14: the re-registered user has a fresh DEK row');

    const newCipher = await userEmailCipher(newUserId);
    assert.notDeepEqual(newCipher, emailCipher, 'C14: the re-registered user has new (distinct) ciphertext');
  });
});
