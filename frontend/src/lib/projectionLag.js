// Eventual-consistency accommodations shared by every repository. Read models
// are projected ASYNC from the event log, so a read can briefly race the write
// it follows. Two proven patterns (extracted from the original slice repo):
//   - a just-created doc may 404 until its projection lands → retry the GET;
//   - after a mutation, a single refetch can race the ~50ms projection → fire a
//     few SPACED invalidations so the view converges on authoritative state.
// v1 simplification — optimistic cache updates would remove the waits.
// See notes/event-sourcing-architecture.md.
import { HttpError } from '@/lib/http'

export const PROJECTION_LAG_MS = 250
const FRESH_DOC_RETRIES = 6

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Run `fn`, retrying transient 404s (fresh-doc projection lag).
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ retries?: number, delayMs?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function retry404(fn, { retries = FRESH_DOC_RETRIES, delayMs = PROJECTION_LAG_MS } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      const transient404 = e instanceof HttpError && e.status === 404 && attempt < retries
      if (!transient404) throw e
      await sleep(delayMs)
    }
  }
}

export const REVALIDATE_DELAYS_MS = [PROJECTION_LAG_MS, 500, 1000]

/**
 * Let the async projections settle, then converge via spaced invalidations.
 * Pass `exact: true` behavior by giving a full key; a short key acts as a
 * prefix (e.g. ['slices'] revalidates every slice board).
 * @param {ReturnType<import('@pinia/colada').useQueryCache>} cache
 * @param {unknown[]} key colada query key (or prefix)
 * @param {{ exact?: boolean, delays?: number[] }} [opts]
 */
export async function spacedInvalidate(cache, key, { exact = false, delays = REVALIDATE_DELAYS_MS } = {}) {
  for (const delay of delays) {
    await sleep(delay)
    await cache.invalidateQueries({ key, exact })
  }
}
