// LAYER 3 — context (swimlane) repository. Lanes are first-class, user-named
// (swimlanes.md); v1 creates them inline from the inspector's Lane control.
//
// Backend paths (build-to contract):
//   GET    /api/contexts?modelId=…   → [{ _id, modelId, name, archived, factCount }]
//   POST   /api/contexts             { modelId, contextId, name }
//   PUT    /api/contexts/:id/name    { name }
//   DELETE /api/contexts/:id
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { http } from '@/lib/http'
import { spacedInvalidate } from '@/lib/projectionLag'

export const CONTEXT_KEYS = {
  root: ['contexts'],
  /** @param {string} modelId */
  byModel: (modelId) => ['contexts', modelId],
}

/** @param {() => string} getModelId reactive model-id getter */
export function useContexts(getModelId) {
  return useQuery({
    key: () => CONTEXT_KEYS.byModel(getModelId()),
    query: () => http.get(`/api/contexts?modelId=${encodeURIComponent(getModelId())}`),
  })
}

export function useDefineContext() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, contextId: string, name: string }} payload */
    mutation: (payload) => http.post('/api/contexts', payload),
    async onSettled(_d, _e, { modelId }) {
      // Immediate refetch races the async projection → spaced follow-ups too.
      await cache.invalidateQueries({ key: CONTEXT_KEYS.byModel(modelId), exact: true })
      void spacedInvalidate(cache, CONTEXT_KEYS.byModel(modelId), { exact: true }).catch(() => {})
    },
  })
}

export function useRenameContext() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, contextId: string, name: string }} vars */
    mutation: ({ contextId, name }) =>
      http.put(`/api/contexts/${contextId}/name`, { name }),
    async onSettled(_d, _e, { modelId }) {
      // Immediate refetch races the async projection → spaced follow-ups too.
      await cache.invalidateQueries({ key: CONTEXT_KEYS.byModel(modelId), exact: true })
      void spacedInvalidate(cache, CONTEXT_KEYS.byModel(modelId), { exact: true }).catch(() => {})
    },
  })
}

export function useArchiveContext() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, contextId: string }} vars */
    mutation: ({ contextId }) => http.del(`/api/contexts/${contextId}`),
    async onSettled(_d, _e, { modelId }) {
      // Immediate refetch races the async projection → spaced follow-ups too.
      await cache.invalidateQueries({ key: CONTEXT_KEYS.byModel(modelId), exact: true })
      void spacedInvalidate(cache, CONTEXT_KEYS.byModel(modelId), { exact: true }).catch(() => {})
    },
  })
}
