// LAYER 3 — model (root container) repository. The W2 dashboard list, the W3
// breadcrumb read, the on-demand validation query (A2 punch-list), and the O1
// export (a state-view query — plain async fn, deliberately outside the cache:
// every click downloads a fresh snapshot).
//
// Backend paths (build-to contract):
//   GET    /api/models               → [{ _id, name, archived, sliceCount }]
//   GET    /api/models/:id           → { _id, name, archived, sliceCount }
//   POST   /api/models               { name } → { ok, modelId }  (server-gen id)
//   PUT    /api/models/:id/name      { name }
//   DELETE /api/models/:id           (archive)
//   GET    /api/models/:id/validation → { modelId, findings:[…] }
//   GET    /api/models/:id/export    → version-stamped whole-model JSON
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { http } from '@/lib/http'
import { retry404, spacedInvalidate } from '@/lib/projectionLag'

export const MODEL_KEYS = {
  root: ['models'],
  /** @param {string} id */
  byId: (id) => ['models', id],
  /** @param {string} id */
  validation: (id) => ['models', id, 'validation'],
}

export function useModels() {
  return useQuery({
    key: () => MODEL_KEYS.root,
    query: () => http.get('/api/models'),
  })
}

/** @param {() => string} getId reactive id getter */
export function useModel(getId) {
  return useQuery({
    key: () => MODEL_KEYS.byId(getId()),
    // retry404: navigating right after create races the async `models` projection.
    query: () => retry404(() => http.get(`/api/models/${getId()}`)),
  })
}

/**
 * On-demand validation (A2): a PLAIN one-shot read, deliberately outside the
 * cache — "Check model" must always hit the server fresh (a disabled colada
 * query won't fetch on refetch()). Advisory only, never gates a command
 * (G-C10).
 * @param {string} modelId
 * @returns {Promise<{ modelId: string, findings: object[] }>}
 */
export function fetchModelValidation(modelId) {
  return http.get(`/api/models/${modelId}/validation`)
}

/**
 * The `models` read model is projected ASYNC — an immediate refetch usually
 * returns the PRE-write state, so every model mutation also schedules spaced
 * invalidations (fire-and-forget) until the list converges.
 */
function settleModels(cache, modelId) {
  void spacedInvalidate(cache, MODEL_KEYS.root, { exact: true }).catch(() => {})
  if (modelId)
    void spacedInvalidate(cache, MODEL_KEYS.byId(modelId), { exact: true }).catch(() => {})
}

export function useCreateModel() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ name: string }} payload @returns {Promise<{ ok: boolean, modelId: string }>} */
    mutation: (payload) => http.post('/api/models', payload),
    async onSettled() {
      await cache.invalidateQueries({ key: MODEL_KEYS.root, exact: true })
      settleModels(cache)
    },
  })
}

export function useRenameModel() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, name: string }} vars */
    mutation: ({ modelId, name }) => http.put(`/api/models/${modelId}/name`, { name }),
    async onSettled(_d, _e, { modelId }) {
      await cache.invalidateQueries({ key: MODEL_KEYS.root, exact: true })
      settleModels(cache, modelId)
    },
  })
}

export function useArchiveModel() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string }} vars */
    mutation: ({ modelId }) => http.del(`/api/models/${modelId}`),
    async onSettled(_d, _e, { modelId }) {
      await cache.invalidateQueries({ key: MODEL_KEYS.root, exact: true })
      settleModels(cache, modelId)
    },
  })
}

/**
 * O1 export — one-shot read, bypasses the cache on purpose (a download must be
 * a fresh snapshot). Caller pairs it with lib/download.js.
 * @param {string} modelId
 */
export function exportModel(modelId) {
  return http.get(`/api/models/${modelId}/export`)
}
