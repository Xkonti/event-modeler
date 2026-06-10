import { defineConfig } from '@playwright/test'

/**
 * E2E config. Two web servers are launched for the suite:
 *   1. the real backend via e2e/start-backend.mjs — the launcher provisions a
 *      THROWAWAY Postgres (testcontainers) itself, then spawns `bun run start`
 *      (cwd ../backend) with the container URI + E2E auth env. It must live in
 *      the webServer command (NOT globalSetup): Playwright spawns webServers
 *      BEFORE globalSetup runs, so env set there never reaches the child — the
 *      backend would fall back to backend/.env's devbox :5432.
 *      Readiness is probed on GET /api/health.
 *   2. the Vite dev server on :5173, which proxies /api/* → :3000.
 *
 * Tests hit the Vite origin only (baseURL :5173); the proxy keeps the
 * better-auth cookie first-party (see auth-build-plan.md §1 + §6).
 *
 * With `devbox services up` already running, reuseExistingServer skips both
 * launches and the suite runs against the devbox stack instead.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node e2e/start-backend.mjs',
      url: 'http://127.0.0.1:3000/api/health',
      timeout: 180 * 1000, // container pull/boot + backend self-migration
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'vite --port 5173 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
