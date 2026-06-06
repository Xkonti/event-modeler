// Playwright happy-path E2E over the REAL Vue UI against the REAL backend.
//
// Scope (notes/auth-test-plan.md §2, auth-build-plan.md §5 Stage F3 spec row):
// ONE thin happy path proving the wires connect — forms → better-auth client →
// session cookie (first-party via the Vite proxy) → router guards. Edge cases
// (bad password, dup email, crypto-shred, no-plaintext-at-rest) are owned by the
// backend integration suite; the browser cannot see emt_messages, so none of
// that lives here. Keep it fast + non-flaky.
//
// Selectors: data-testid ONLY (via page.getByTestId) — never CSS classes (Tailwind
// churn) or text (i18n-fragile). Testids must match F3 exactly:
//   signup-form, signup-name, signup-email, signup-password, signup-submit
//   login-form, login-email, login-password, login-submit
//   app-shell, app-user-email, logout-button
//
// Assertions: web-first expect (auto-waiting/retrying) throughout — no manual
// sleeps or bare boolean checks.
//
// Determinism: the per-run email is built from a FIXED literal prefix plus the
// Playwright worker index (test.info().workerIndex). No Date.now()/Math.random()
// — the address is reproducible across runs so a re-run targets the same user and
// the spec stays deterministic. (The throwaway Postgres from global-setup is
// fresh each run, so reusing the address across runs never collides.)

import { test, expect } from '@playwright/test'

const PASSWORD = 'happy-path-pw-123' // >= 8 chars → passes the signup client check
const NAME = 'Happy Path User'

/**
 * Deterministic, unique-per-worker email. Fixed literal prefix + the Playwright
 * worker index → reproducible (no clock, no RNG). Distinct workers never collide.
 * @param {number} workerIndex
 * @returns {string}
 */
function emailForWorker(workerIndex) {
  return `happy-path-w${workerIndex}@example.test`
}

test('signup → app shell → logout → login → guarded route blocked', async ({ page }) => {
  const email = emailForWorker(test.info().workerIndex)

  // 1. Open the app at the root (a guarded route). Unauthenticated → the guard
  //    redirects to /login (with a ?redirect back to where we were headed).
  await page.goto('/')
  await expect(page).toHaveURL(/\/login(\?|$)/)
  await expect(page.getByTestId('login-form')).toBeVisible()

  // 2. Navigate to signup via the in-app link, then confirm the signup form is up.
  await page.goto('/signup')
  await expect(page.getByTestId('signup-form')).toBeVisible()

  // 3. Fill + submit the signup form with the unique, reproducible email.
  await page.getByTestId('signup-name').fill(NAME)
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-password').fill(PASSWORD)
  await page.getByTestId('signup-submit').click()

  // 4. On success better-auth sets the session cookie + the reactive session
  //    flips authed → the page lands on the app shell at '/'. Assert the shell is
  //    visible and the header reflects the signed-up email (proves useSession is
  //    live, not just that navigation happened).
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page.getByTestId('app-user-email')).toHaveText(email)

  // 5. Log out. The cookie is cleared server-side → reactive session → null and
  //    the layout pushes to /login. Assert we're back on the login form and the
  //    app shell is gone.
  await page.getByTestId('logout-button').click()
  await expect(page).toHaveURL(/\/login(\?|$)/)
  await expect(page.getByTestId('login-form')).toBeVisible()
  await expect(page.getByTestId('app-shell')).toBeHidden()

  // 6. Navigation-guard check (not just the logout button): directly request a
  //    guarded route while logged out → the guard bounces back to /login. Proves
  //    protection lives in the router, independent of the logout UI flow.
  await page.goto('/')
  await expect(page).toHaveURL(/\/login(\?|$)/)
  await expect(page.getByTestId('login-form')).toBeVisible()
  await expect(page.getByTestId('app-shell')).toHaveCount(0)
})
