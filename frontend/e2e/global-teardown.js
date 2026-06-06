/**
 * Playwright globalTeardown — stop the throwaway Postgres started in
 * global-setup.js. Runs in the same runner process, so the container handle
 * stashed on `globalThis` is still reachable. No-op if setup never ran.
 */
export default async function globalTeardown() {
  const container = globalThis.__EM_PG_CONTAINER__
  if (container) {
    await container.stop()
    globalThis.__EM_PG_CONTAINER__ = undefined
    // eslint-disable-next-line no-console
    console.log('[e2e] throwaway Postgres stopped')
  }
}
