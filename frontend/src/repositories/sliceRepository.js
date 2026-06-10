// LAYER 3 — slice domain repository. The ONLY place that imports both
// @pinia/colada (cache) and the http transport for the slice aggregate. A slice
// GET returns the whole board (placements pre-sorted band→slot, relations with
// their STORED kind, auto-surfaced scenarios — archived entities already
// filtered server-side). Placement is SNAP-SLOT (F3): `{ slotRole, slot }`
// computed server-side, NO x/y anywhere; reorder is a slot SWAP.
//
// Backend paths (build-to contract — backend/src/domain/slice/api.ts):
//   GET    /api/slices/:id
//     → { _id, modelId, name,
//          placements:[{entityId,entityType,slotRole,slot?,lane?,name,definition}],
//          relations:[{_id,fromId,toId,kind,meta?}],
//          scenarios:[{_id,kind,anchorId,given,when?,then,referencedEntityIds}] }
//     placements arrive SORTED band→slot — response order IS render order.
//   GET    /api/models/:id/slices                  → [{_id,name}] creation order
//   POST   /api/slices                             { modelId, sliceId, name? }
//   PUT    /api/slices/:id/name                    { name }
//   DELETE /api/slices/:id
//   POST   /api/slices/:id/placements              { placedEntityId }
//   POST   /api/slices/:id/swaps                   { entityIdA, entityIdB }
//   DELETE /api/slices/:id/placements/:placedId
//
// Mutations take a SINGLE object arg carrying the ids onSettled needs for
// invalidation. Board mutations spaced-invalidate the ['slices'] PREFIX (the
// multi-box canvas reads one combined boards query; relations/scenarios embed
// in slice GETs) — chatty but correct, accepted for v1.
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { http } from '@/lib/http'
import { retry404, spacedInvalidate } from '@/lib/projectionLag'
import { MODEL_KEYS } from '@/repositories/modelRepository'

// 1. query keys — single source of truth for invalidation.
export const SLICE_KEYS = {
  root: ['slices'],
  /** @param {string} id */
  byId: (id) => ['slices', id],
  /** @param {string} modelId */
  listByModel: (modelId) => ['slices', 'byModel', modelId],
  /** @param {string[]} ids */
  boards: (ids) => ['slices', 'boards', ids.join(',')],
}

/** GET one board, retrying a transient 404 (fresh-slice projection lag). */
const getSlice = (id) => retry404(() => http.get(`/api/slices/${id}`))

// 2. read composables.
/**
 * @param {() => string} getId reactive id getter
 * @param {{ enabled?: () => boolean }} [opts] callers with an optional id gate
 *        the fetch (an empty id would 404-retry pointlessly)
 */
export function useSlice(getId, { enabled } = {}) {
  return useQuery({
    key: () => SLICE_KEYS.byId(getId()),
    query: () => getSlice(getId()),
    ...(enabled ? { enabled } : {}),
  })
}

/**
 * The model's slices in creation order — drives the W3 left→right tiling.
 * @param {() => string} getModelId reactive model-id getter
 */
export function useModelSlices(getModelId) {
  return useQuery({
    key: () => SLICE_KEYS.listByModel(getModelId()),
    query: () => http.get(`/api/models/${getModelId()}/slices`),
  })
}

/**
 * Every visible board in ONE query (the multi-box canvas input). Keyed by the
 * id list, so scope changes refetch; any board mutation's ['slices'] prefix
 * invalidation also hits it.
 * @param {() => string[]} getIds reactive creation-ordered slice ids
 */
export function useSliceBoards(getIds) {
  return useQuery({
    key: () => SLICE_KEYS.boards(getIds()),
    query: () => Promise.all(getIds().map(getSlice)),
  })
}

// 3. writes — each converges the affected reads on settle.

/** Re-converge every board (prefix) without blocking the caller's save. */
function settleBoards(cache) {
  void spacedInvalidate(cache, SLICE_KEYS.root).catch(() => {})
}

export function useDefineSlice() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, sliceId: string, name?: string }} payload */
    mutation: (payload) => http.post('/api/slices', payload),
    async onSettled(_d, _e, { modelId }) {
      // New box: tiling list + model sliceCount now, boards converge spaced.
      await cache.invalidateQueries({ key: SLICE_KEYS.listByModel(modelId), exact: true })
      await cache.invalidateQueries({ key: MODEL_KEYS.root, exact: true })
      void spacedInvalidate(cache, SLICE_KEYS.listByModel(modelId), { exact: true }).catch(() => {})
      settleBoards(cache)
    },
  })
}

export function useRenameSlice() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, sliceId: string, name: string }} vars */
    mutation: ({ sliceId, name }) => http.put(`/api/slices/${sliceId}/name`, { name }),
    async onSettled(_d, _e, { modelId }) {
      await cache.invalidateQueries({ key: SLICE_KEYS.listByModel(modelId), exact: true })
      void spacedInvalidate(cache, SLICE_KEYS.listByModel(modelId), { exact: true }).catch(() => {})
      settleBoards(cache)
    },
  })
}

export function useArchiveSlice() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, sliceId: string }} vars */
    mutation: ({ sliceId }) => http.del(`/api/slices/${sliceId}`),
    async onSettled(_d, _e, { modelId }) {
      await cache.invalidateQueries({ key: SLICE_KEYS.listByModel(modelId), exact: true })
      await cache.invalidateQueries({ key: MODEL_KEYS.root, exact: true })
      void spacedInvalidate(cache, SLICE_KEYS.listByModel(modelId), { exact: true }).catch(() => {})
      settleBoards(cache)
    },
  })
}

export function usePlaceEntity() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ sliceId: string, placedEntityId: string }} vars — band+slot computed server-side (F3) */
    mutation: ({ sliceId, placedEntityId }) =>
      http.post(`/api/slices/${sliceId}/placements`, { placedEntityId }),
    onSettled() {
      settleBoards(cache)
    },
  })
}

export function useSwapSlots() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ sliceId: string, entityIdA: string, entityIdB: string }} vars */
    mutation: ({ sliceId, entityIdA, entityIdB }) =>
      http.post(`/api/slices/${sliceId}/swaps`, { entityIdA, entityIdB }),
    onSettled() {
      settleBoards(cache)
    },
  })
}

export function useRemovePlacement() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ sliceId: string, placedId: string }} vars */
    mutation: ({ sliceId, placedId }) =>
      http.del(`/api/slices/${sliceId}/placements/${placedId}`),
    onSettled() {
      settleBoards(cache)
    },
  })
}
