/**
 * B6–B9 — route protection. The businessFact WRITE routes are guarded by
 * `requireAuth(auth)` (mounted under `/api` by `buildAuthApp`), so the live path
 * is `POST /api/business-facts`. GET stays open in v1
 * (notes/auth-architecture.md).
 *
 * These prove the guard validates against the SESSION TABLE, not mere cookie
 * presence: an authed request passes, no cookie / a forged cookie / a post-
 * logout cookie all 401, and logout genuinely removes the `auth_session` row.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bootAuthHarness,
  freshCreds,
  hasSessionCookie,
  logout,
  signup,
  stopAuthHarness,
  userIdForEmail,
  type AuthHarness,
  type CookieJar,
} from './_authHarness.ts';
import { randomBytes } from 'node:crypto';

describe('route protection (B6–B9)', () => {
  let h: AuthHarness;

  before(async () => {
    h = await bootAuthHarness();
  });
  after(async () => {
    await stopAuthHarness();
  });

  const defineFact = (jar: CookieJar) =>
    jar.fetch('/api/business-facts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        modelId: `m-${randomBytes(5).toString('hex')}`,
        entityId: `f-${randomBytes(5).toString('hex')}`,
        name: `Fact ${randomBytes(5).toString('hex')}`,
        fields: [],
      }),
    });

  it('B6: an authenticated POST to a protected endpoint succeeds', async () => {
    const jar = h.jar();
    assert.equal((await signup(jar, freshCreds())).status, 200);
    assert.ok(hasSessionCookie(jar));

    const res = await defineFact(jar);
    const body = (await res.json()) as { ok?: boolean };
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.ok, true);
  });

  it('B7: an unauthenticated POST to a protected endpoint is 401', async () => {
    const jar = h.jar(); // no signup → no cookie
    const res = await defineFact(jar);
    assert.equal(res.status, 401, await res.text());
  });

  it('B8: a request with a forged/garbage session cookie is 401', async () => {
    const jar = h.jar();
    // Inject a bogus session cookie directly into the jar.
    jar.cookies().set('better-auth.session_token', 'totally-bogus-not-a-real-token');
    const res = await defineFact(jar);
    assert.equal(res.status, 401, 'a forged cookie must not authenticate');
  });

  it('B9: after logout the protected request is 401 and the session row is gone', async () => {
    const jar = h.jar();
    const creds = freshCreds();
    assert.equal((await signup(jar, creds)).status, 200);
    assert.ok(hasSessionCookie(jar));

    const userId = await userIdForEmail(h, creds.email);
    assert.ok(userId);

    // Pre-logout: a session row exists for this user.
    const before = await h.pgQuery(
      `SELECT 1 FROM auth_session WHERE user_id = $1`,
      [userId],
    );
    assert.ok(before.length >= 1, 'a session row must exist after signup');

    // Logout — the response must CLEAR the cookie (empty/Max-Age=0 → jar drops it).
    const out = await logout(jar);
    assert.equal(out.status, 200, await out.text());
    assert.ok(!hasSessionCookie(jar), 'logout must clear the session cookie');

    // Re-using the post-logout jar against the guarded route → 401.
    const res = await defineFact(jar);
    assert.equal(res.status, 401, 'protected route blocked after logout');

    // At-DB: the session row is genuinely deleted (plain-table + ephemeral).
    const afterRows = await h.pgQuery(
      `SELECT 1 FROM auth_session WHERE user_id = $1`,
      [userId],
    );
    assert.equal(afterRows.length, 0, 'the auth_session row must be deleted on logout');
  });
});
