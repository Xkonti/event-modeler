// E2E backend launcher — runs AS the Playwright backend webServer command.
//
// Why a wrapper: Playwright spawns `webServer` processes BEFORE globalSetup
// runs (webServer is a plugin; plugins set up first), so a globalSetup-
// provisioned testcontainer URI can never reach the backend child via
// process.env — the backend would silently fall back to backend/.env's
// devbox Postgres (:5432) and ECONNREFUSED when devbox isn't running. This
// wrapper provisions the throwaway Postgres ITSELF, then spawns the backend
// with the container URI + the E2E auth env (LOCKED names, auth-build-plan
// §1.1) and mirrors its lifecycle.
//
// NOTE: when a backend is already running on :3000 (devbox services up),
// Playwright's `reuseExistingServer` skips this wrapper entirely — the suite
// then runs against the devbox stack, matching the user's local workflow.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PostgreSqlContainer } from '@testcontainers/postgresql'

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../backend')

console.log('[e2e] starting throwaway Postgres…')
const container = await new PostgreSqlContainer('postgres:16-alpine').start()
const uri = container.getConnectionUri()
console.log(`[e2e] throwaway Postgres ready → ${uri}`)

const child = spawn('bun', ['run', 'start'], {
  cwd: backendDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    POSTGRESQL_CONNECTION_STRING: uri,
    PORT: '3000',
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET ?? 'e2e-only-secret-change-me-not-for-prod-0123456789',
    BETTER_AUTH_URL: 'http://localhost:5173',
    AUTH_TRUSTED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
    AUTH_KEK: process.env.AUTH_KEK ?? Buffer.alloc(32, 7).toString('base64'),
    EMAIL_INDEX_KEY:
      process.env.EMAIL_INDEX_KEY ?? Buffer.alloc(32, 11).toString('base64'),
  },
})

let stopping = false
async function shutdown(code) {
  if (stopping) return
  stopping = true
  try {
    child.kill('SIGTERM')
  } catch {}
  await container.stop().catch(() => {})
  process.exit(code)
}

child.on('exit', (code) => void shutdown(code ?? 0))
process.on('SIGTERM', () => void shutdown(0))
process.on('SIGINT', () => void shutdown(0))
