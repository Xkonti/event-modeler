// LAYER 3 — command domain repository. Mirror of businessFactRepository: the
// ONLY place that imports both @pinia/colada (cache) and the http transport for
// the command entity. Owns the query keys, exposes read composables wrapping
// useQuery and mutation factories wrapping useMutation. Components call these;
// they never touch fetch or raw cache keys. See notes/frontend-architecture.md §3.
//
// Backend paths are under the /api prefix:
//   GET    /api/commands/:id   (no list endpoint in v1; root stubbed for later)
//   POST   /api/commands
//   PUT    /api/commands/:id/name
//   DELETE /api/commands/:id
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { http } from '@/lib/http'

// 1. query keys — single source of truth for invalidation.
export const COMMAND_KEYS = {
  root: ['commands'],
  /** @param {string} id */
  byId: (id) => ['commands', id],
}

// 2. read composable — wraps useQuery, returns colada refs to the caller.
/**
 * @param {() => string} getId reactive id getter (so the key tracks route params)
 */
export function useCommand(getId) {
  return useQuery({
    key: () => COMMAND_KEYS.byId(getId()),
    query: () => http.get(`/api/commands/${getId()}`),
  })
}

// 3. writes — mutation factories. Invalidate affected keys on settle so the
//    reads above refetch automatically. onSettled(data, error, vars).
export function useDefineCommand() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ entityId: string, name: string, context: string }} payload */
    mutation: (payload) => http.post('/api/commands', payload),
    async onSettled() {
      await cache.invalidateQueries({ key: COMMAND_KEYS.root })
    },
  })
}

export function useRenameCommand() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ id: string, name: string }} vars */
    mutation: ({ id, name }) => http.put(`/api/commands/${id}/name`, { name }),
    async onSettled(_data, _error, { id }) {
      await cache.invalidateQueries({ key: COMMAND_KEYS.byId(id), exact: true })
      await cache.invalidateQueries({ key: COMMAND_KEYS.root })
    },
  })
}
