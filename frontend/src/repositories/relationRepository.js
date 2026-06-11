// LAYER 3 — relation repository. Relations are MODEL-level links (drawing an
// arrow authors a relation; canvas arrows are projections of them). The KIND is
// STORED (F4) — the W7 picker submits it; the backend validates against the
// 11-pair allow-list (422 invalid pair/kind, 409 duplicate (from,to,kind)).
//
// Backend paths (build-to contract):
//   POST   /api/relations             { modelId, relationId, fromId, toId, kind, meta? }
//   PUT    /api/relations/:id         { kind?, meta? }
//   DELETE /api/relations/:id
//   GET    /api/relations/:id         → { _id, modelId, fromId, toId, kind, meta? }
//   GET    /api/models/:id/relations  → [{ _id, fromId, toId, kind, meta? }]
//
// Same-slice edges embed in every slice GET → board convergence rides the
// ['slices'] prefix invalidation. The model-level list feeds the auto-displayed
// read models (cards + cross-slice arrows) → every mutation also spaced-
// invalidates the ['relations'] prefix.
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { http } from '@/lib/http'
import { retry404, spacedInvalidate } from '@/lib/projectionLag'
import { SLICE_KEYS } from '@/repositories/sliceRepository'

export const RELATION_KEYS = {
  root: ['relations'],
  /** @param {string} id */
  byId: (id) => ['relations', id],
  /** @param {string} modelId */
  byModel: (modelId) => ['relations', 'byModel', modelId],
}

/**
 * All relations of a model — the auto-read-model display derives cards and
 * arrows (incl. cross-slice feeds) from this graph.
 * @param {() => string} getModelId reactive model-id getter
 */
export function useModelRelations(getModelId) {
  return useQuery({
    key: () => RELATION_KEYS.byModel(getModelId()),
    query: () => http.get(`/api/models/${getModelId()}/relations`),
  })
}

/**
 * @param {() => string} getId reactive relation-id getter
 * @param {{ enabled?: () => boolean }} [opts]
 */
export function useRelation(getId, { enabled } = {}) {
  return useQuery({
    key: () => RELATION_KEYS.byId(getId()),
    query: () => retry404(() => http.get(`/api/relations/${getId()}`)),
    ...(enabled ? { enabled } : {}),
  })
}

async function settle(cache, relationId) {
  if (relationId)
    await cache.invalidateQueries({ key: RELATION_KEYS.byId(relationId), exact: true })
  void spacedInvalidate(cache, SLICE_KEYS.root).catch(() => {})
  // Refresh the model-level graph too (auto-RM cards/arrows).
  void spacedInvalidate(cache, RELATION_KEYS.root).catch(() => {})
}

export function useDrawRelation() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, relationId: string, fromId: string, toId: string, kind: string, meta?: object }} payload */
    mutation: (payload) => http.post('/api/relations', payload),
    async onSettled(_d, _e, { relationId }) {
      await settle(cache, relationId)
    },
  })
}

export function useUpdateRelation() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ relationId: string, kind?: string, meta?: object }} vars */
    mutation: ({ relationId, kind, meta }) =>
      http.put(`/api/relations/${relationId}`, {
        ...(kind !== undefined ? { kind } : {}),
        ...(meta !== undefined ? { meta } : {}),
      }),
    async onSettled(_d, _e, { relationId }) {
      await settle(cache, relationId)
    },
  })
}

export function useDeleteRelation() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ relationId: string }} vars */
    mutation: ({ relationId }) => http.del(`/api/relations/${relationId}`),
    async onSettled(_d, _e, { relationId }) {
      await settle(cache, relationId)
    },
  })
}
