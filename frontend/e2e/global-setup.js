import { PostgreSqlContainer } from '@testcontainers/postgresql'

/**
 * Playwright globalSetup — provision a throwaway Postgres for the E2E run.
 *
 * Runs in the Playwright runner process BEFORE the `webServer` array spawns.
 * We start a disposable Postgres container and inject its URI plus the auth env
 * vars into `process.env`; the backend web server (a child process) inherits
 * them and self-migrates the Emmett schema + constraint/auth tables on boot.
 *
 * The container handle is stashed on `globalThis` so global-teardown.js can
 * stop it. Returning nothing is fine — Playwright only needs the promise.
 *
 * Env names match the LOCKED contract (auth-build-plan.md §1.1). The KEK and
 * email-index key are throwaway 32-byte base64 values, fine for ephemeral E2E.
 */
export default async function globalSetup() {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start()
  const uri = container.getConnectionUri()

  // Backend reads POSTGRESQL_CONNECTION_STRING + PORT (see backend/src/config.ts).
  process.env.POSTGRESQL_CONNECTION_STRING = uri
  process.env.PORT = '3000'

  // better-auth core — BROWSER-FACING (proxied) origin in dev/E2E.
  process.env.BETTER_AUTH_SECRET =
    process.env.BETTER_AUTH_SECRET ?? 'e2e-only-secret-change-me-not-for-prod-0123456789'
  process.env.BETTER_AUTH_URL = 'http://localhost:5173'
  process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'

  // crypto-shredding keys — throwaway 32-byte base64, ephemeral E2E only.
  process.env.AUTH_KEK =
    process.env.AUTH_KEK ?? Buffer.alloc(32, 7).toString('base64')
  process.env.EMAIL_INDEX_KEY =
    process.env.EMAIL_INDEX_KEY ?? Buffer.alloc(32, 11).toString('base64')

  globalThis.__EM_PG_CONTAINER__ = container
  // eslint-disable-next-line no-console
  console.log(`[e2e] throwaway Postgres ready → ${uri}`)
}
