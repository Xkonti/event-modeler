/**
 * A1–A5 — signup + login lifecycle over real HTTP against a real Postgres.
 * No mocking of better-auth / the adapter / crypto; the only fake is the
 * throwaway testcontainers DB.
 *
 * The crux is A1's "no plaintext PII at rest": every `user-*` / `account-*`
 * event row in `emt_messages.message_data` must be FREE of the raw email / name
 * / password and yet CONTAIN the cipher keys `iv` / `authTag` / `ct` (PII is
 * present-but-encrypted, not merely absent — positive control).
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

describe('signup + login lifecycle (A1–A5)', () => {
  let h: AuthHarness;

  before(async () => {
    h = await bootAuthHarness();
  });
  after(async () => {
    await stopAuthHarness();
  });

  /** All `message_data::text` of a user's user-/account-event rows. */
  const eventPayloads = async (userId: string, accountIds: string[]): Promise<string[]> => {
    const streamIds = [`user-${userId}`, ...accountIds.map((a) => `account-${a}`)];
    const rows = await h.pgQuery<{ message_type: string; d: string }>(
      `SELECT message_type, message_data::text AS d
         FROM emt_messages
        WHERE stream_id = ANY($1)`,
      [streamIds],
    );
    return rows.map((r) => r.d);
  };

  it('A1: signup writes an ES user + account, the blind index + DEK keystore rows, and NO plaintext PII', async () => {
    const jar = h.jar();
    const creds = freshCreds();
    const res = await signup(jar, creds);

    // 200 + a session cookie set (assert by PREFIX, never the exact name).
    assert.equal(res.status, 200, await res.text());
    assert.ok(hasSessionCookie(jar), 'signup must set a better-auth session cookie');

    // Resolve the user id via the blind index — never from plaintext.
    const userId = await userIdForEmail(h, creds.email);
    assert.ok(userId, 'blind-index row must map email_hash → user_id');

    // ES write happened: a UserRegistered on the user stream …
    const userEvents = await h.pgQuery<{ message_type: string }>(
      `SELECT message_type FROM emt_messages WHERE stream_id = $1`,
      [`user-${userId}`],
    );
    assert.ok(
      userEvents.some((e) => e.message_type === 'UserRegistered'),
      'a UserRegistered event must exist on the user stream',
    );

    // … and an AccountLinked on the account stream (find the account id by user).
    const accountRows = await h.pgQuery<{ account_id: string }>(
      `SELECT account_id FROM auth_account_index WHERE user_id = $1`,
      [userId],
    );
    assert.equal(accountRows.length, 1, 'exactly one linked account');
    const accountIds = accountRows.map((r) => r.account_id);
    const accountEvents = await h.pgQuery<{ message_type: string }>(
      `SELECT message_type FROM emt_messages WHERE stream_id = $1`,
      [`account-${accountIds[0]}`],
    );
    assert.ok(
      accountEvents.some((e) => e.message_type === 'AccountLinked'),
      'an AccountLinked event must exist on the account stream',
    );

    // DEK keystore: exactly one wrapped-DEK row, and it is NOT the raw plaintext.
    const dekRows = await h.pgQuery<{ wrapped_dek: { iv: string; authTag: string; ct: string } }>(
      `SELECT wrapped_dek FROM auth_user_keys WHERE user_id = $1`,
      [userId],
    );
    assert.equal(dekRows.length, 1, 'exactly one DEK keystore row');
    const wrapped = dekRows[0]!.wrapped_dek;
    assert.ok(wrapped.iv && wrapped.authTag && wrapped.ct, 'DEK stored as a KEK-wrapped cipher blob');
    const wrappedText = JSON.stringify(wrapped);
    assert.ok(!wrappedText.includes(creds.email), 'wrapped DEK must not contain the email');
    assert.ok(!wrappedText.includes(creds.password), 'wrapped DEK must not contain the password');

    // THE CRUX — no plaintext PII at rest, with a positive control.
    const payloads = await eventPayloads(userId, accountIds);
    assert.ok(payloads.length >= 2, 'both user + account events present');
    for (const d of payloads) {
      assert.ok(!d.includes(creds.email), 'event payload must NOT contain the raw email');
      assert.ok(!d.includes(creds.name!), 'event payload must NOT contain the raw name');
      assert.ok(!d.includes(creds.password), 'event payload must NOT contain the raw password');
      // Positive control: PII IS there, encrypted — cipher keys present.
      assert.ok(d.includes('"iv"'), 'event payload must contain the cipher `iv` key');
      assert.ok(d.includes('"authTag"'), 'event payload must contain the cipher `authTag` key');
      assert.ok(d.includes('"ct"'), 'event payload must contain the cipher `ct` key');
    }

    // Blind-index table holds ONLY non-PII columns (email_hash + user_id).
    const idxRows = await h.pgQuery<{ email_hash: string; user_id: string }>(
      `SELECT email_hash, user_id FROM auth_user_email_index WHERE user_id = $1`,
      [userId],
    );
    assert.equal(idxRows.length, 1);
    assert.equal(idxRows[0]!.email_hash, h.emailBlindIndex(creds.email));
    const idxText = JSON.stringify(idxRows[0]);
    assert.ok(!idxText.includes(creds.email), 'index table must not store the raw email');
  });

  it('A2: a duplicate-email signup is rejected by the blind-index uniqueness constraint', async () => {
    const jar1 = h.jar();
    const creds = freshCreds();
    const ok = await signup(jar1, creds);
    assert.equal(ok.status, 200, await ok.text());

    // Re-register the SAME email in a case/whitespace variant → same blind index.
    const jar2 = h.jar();
    const variant = { ...creds, email: `  ${creds.email.toUpperCase()}  ` };
    const dup = await signup(jar2, variant);
    assert.ok(dup.status >= 400, `duplicate signup must be rejected, got ${dup.status}`);
    assert.ok(!hasSessionCookie(jar2), 'a rejected signup must not set a session cookie');

    // Exactly one user stream + one index row survive for that email.
    const emailHash = h.emailBlindIndex(creds.email);
    const idxRows = await h.pgQuery(
      `SELECT user_id FROM auth_user_email_index WHERE email_hash = $1`,
      [emailHash],
    );
    assert.equal(idxRows.length, 1, 'still exactly one index row after the dup attempt');
    const userId = await userIdForEmail(h, creds.email);
    const registers = await h.pgQuery(
      `SELECT 1 FROM emt_messages
        WHERE stream_id = $1 AND message_type = 'UserRegistered'`,
      [`user-${userId}`],
    );
    assert.equal(registers.length, 1, 'only ONE UserRegistered for that email');
  });

  it('A3: login with the correct password sets a session cookie', async () => {
    const creds = freshCreds();
    const signupJar = h.jar();
    assert.equal((await signup(signupJar, creds)).status, 200);

    // Fresh jar → the login itself must mint the session (exercises the read path:
    // blind-index → fold stream → unwrap DEK → decrypt hash → verify).
    const loginJar = h.jar();
    const res = await login(loginJar, creds);
    assert.equal(res.status, 200, await res.text());
    assert.ok(hasSessionCookie(loginJar), 'correct login must set a session cookie');
  });

  it('A4: login with the wrong password yields no session', async () => {
    const creds = freshCreds();
    assert.equal((await signup(h.jar(), creds)).status, 200);

    const loginJar = h.jar();
    const res = await login(loginJar, { email: creds.email, password: 'wrong-password' });
    assert.ok(res.status >= 400, `bad password must be rejected, got ${res.status}`);
    assert.ok(!hasSessionCookie(loginJar), 'wrong password must NOT set a session cookie');
  });

  it('A5: login for an unknown email returns no session and does not leak existence', async () => {
    const loginJar = h.jar();
    const res = await login(loginJar, {
      email: freshCreds().email, // never registered
      password: 'whatever',
    });
    assert.ok(res.status >= 400, `unknown email must be rejected, got ${res.status}`);
    assert.ok(!hasSessionCookie(loginJar), 'unknown email must NOT set a session cookie');
  });
});
