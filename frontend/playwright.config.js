import { defineConfig } from '@playwright/test'

/**
 * E2E config. Two web servers are launched for the suite:
 *   1. the real backend (`bun run start`, cwd ../backend) — self-migrates the
 *      Emmett schema + constraint tables on boot, then serves on :3000.
 *      Readiness is probed on GET /api/health.
 *   2. the Vite dev server on :5173, which proxies /api/* → :3000.
 *
 * Tests hit the Vite origin only (baseURL :5173); the proxy keeps the
 * better-auth cookie first-party (see auth-build-plan.md §1 + §6).
 *
 * globalSetup provisions a throwaway Postgres (testcontainers) and writes its
 * URI + the auth env vars into process.env BEFORE the web servers spawn, so the
 * backend child process inherits a clean DB. globalTeardown stops the container.
 */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',
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
      command: 'bun run start',
      cwd: '../backend',
      url: 'http://127.0.0.1:3000/api/health',
      timeout: 120 * 1000,
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
