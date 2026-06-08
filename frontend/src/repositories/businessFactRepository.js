// LAYER 3 — business-fact domain repository. The ONLY place that imports both
// @pinia/colada (cache) and the http transport. Owns the query keys (single
// source of truth for invalidation), exposes read composables wrapping useQuery
// and mutation factories wrapping useMutation. Components call these; they never
// touch fetch or raw cache keys. See notes/frontend-architecture.md §3.
//
// Backend paths are under the /api prefix (LOCKED, auth-build-plan §1 / §5):
//   GET    /api/business-facts/:id
//   POST   /api/business-facts
//   PUT    /api/business-facts/:id/name
// There is no list endpoint in v1 (auth-build-plan §7); FACT_KEYS.root and the
// list composable are stubbed for when the backend adds GET /api/business-facts.
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { http } from '@/lib/http'

// 1. query keys — single source of truth for invalidation.
export const FACT_KEYS = {
  root: ['business-facts'],
  /** @param {string} id */
  byId: (id) => ['business-facts', id],
}

// 2. read composable — wraps useQuery, returns colada refs to the caller.
/**
 * @param {() => string} getId reactive id getter (so the key tracks route params)
 */
export function useBusinessFact(getId) {
  return useQuery({
    key: () => FACT_KEYS.byId(getId()),
    query: () => http.get(`/api/business-facts/${getId()}`),
  })
}

// list variant — uncomment once the backend exposes GET /api/business-facts:
// export function useBusinessFacts() {
//   return useQuery({ key: FACT_KEYS.root, query: () => http.get('/api/business-facts') })
// }

// 3. writes — mutation factories. Invalidate affected keys on settle so the
//    reads above refetch automatically. onSettled(data, error, vars).
export function useDefineBusinessFact() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ entityId: string, name: string, context: string }} payload */
    mutation: (payload) => http.post('/api/business-facts', payload),
    async onSettled() {
      await cache.invalidateQueries({ key: FACT_KEYS.root })
    },
  })
}

export function useRenameBusinessFact() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ id: string, name: string }} vars */
    mutation: ({ id, name }) => http.put(`/api/business-facts/${id}/name`, { name }),
    async onSettled(_data, _error, { id }) {
      await cache.invalidateQueries({ key: FACT_KEYS.byId(id), exact: true })
      await cache.invalidateQueries({ key: FACT_KEYS.root })
    },
  })
}
