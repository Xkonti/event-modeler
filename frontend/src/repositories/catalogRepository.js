// LAYER 3 — entity-catalog repository (read-only). Feeds the W3 palette, every
// entity picker, and the dup-name 409 lookup. Mutations live on the per-type
// entity repos, which invalidate this key after every catalog write.
//
// Backend path (build-to contract):
//   GET /api/models/:id/entities
//     → [{ _id, entityType, name, contextId?, definedAtPosition? }]
//       creation order, archived excluded, slices excluded (server-side).
import { useQuery } from '@pinia/colada'
import { http } from '@/lib/http'

export const CATALOG_KEYS = {
  root: ['catalog'],
  /** @param {string} modelId */
  byModel: (modelId) => ['catalog', modelId],
}

/** @param {() => string} getModelId reactive model-id getter */
export function useCatalog(getModelId) {
  return useQuery({
    key: () => CATALOG_KEYS.byModel(getModelId()),
    query: () => http.get(`/api/models/${getModelId()}/entities`),
  })
}
