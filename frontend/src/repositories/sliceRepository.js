// LAYER 3 — slice domain repository. The ONLY place that imports both
// @pinia/colada (cache) and the http transport for the slice aggregate. A slice
// is the canvas: its single GET returns the whole board (placements + relations,
// archived entities already filtered server-side), so ONE query key feeds the
// vue-flow host. Mutations each invalidate that key (exact) on settle so the
// canvas refetches the authoritative board. See notes/frontend-architecture.md §3.
//
// Backend paths (build-to contract):
//   GET    /api/slices/:id
//     → { _id, name, placements:[{entityId,x,y,name,entityType}],
//          relations:[{_id,fromId,toId,kind}] }
//   POST   /api/slices                              { entityId, name? }
//   PUT    /api/slices/:id/name                     { name }
//   DELETE /api/slices/:id
//   POST   /api/slices/:id/placements               { placedEntityId, x, y }
//   PUT    /api/slices/:id/placements/:placedId     { x, y }   (move)
//   DELETE /api/slices/:id/placements/:placedId
//   POST   /api/relations                           { entityId, fromId, toId } → 200/422/409
//   DELETE /api/relations/:id
//
// Mutations take a SINGLE object arg that always carries `sliceId` so onSettled
// can invalidate the owning slice without a closure over route state.
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { http, HttpError } from '@/lib/http'

// 1. query keys — single source of truth for invalidation.
export const SLICE_KEYS = {
  root: ['slices'],
  /** @param {string} id */
  byId: (id) => ['slices', id],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Read models are projected ASYNC from the event log, so a read can briefly race
// the write it follows (eventual consistency). Two small accommodations keep the
// canvas robust without optimistic-cache surgery (a v1 simplification):
//   - a just-created slice may 404 until its projection lands → retry the GET;
//   - after a mutation, let the ~50ms projection settle before refetching so the
//     authoritative board reflects the change. See notes/event-sourcing-architecture.md.
const PROJECTION_LAG_MS = 250
const FRESH_SLICE_RETRIES = 6

/** GET the slice, retrying a transient 404 (fresh-slice projection lag). */
async function getSlice(id) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await http.get(`/api/slices/${id}`)
    } catch (e) {
      const transient404 =
        e instanceof HttpError && e.status === 404 && attempt < FRESH_SLICE_RETRIES
      if (!transient404) throw e
      await sleep(PROJECTION_LAG_MS)
    }
  }
}

// A single refetch can race the ~50ms projection: a fresh placement whose catalog
// row hasn't landed is dropped by the GET join and, with no further refetch, never
// reappears. Fire a few SPACED refetches so the board converges on the authoritative
// state. (v1 simplification; optimistic cache updates would remove the wait.)
const REVALIDATE_DELAYS_MS = [PROJECTION_LAG_MS, 500, 1000]

/** Let the async projections settle, then converge the board via spaced refetches. */
async function revalidateSlice(cache, sliceId) {
  for (const delay of REVALIDATE_DELAYS_MS) {
    await sleep(delay)
    await cache.invalidateQueries({ key: SLICE_KEYS.byId(sliceId), exact: true })
  }
}

// 2. read composable — wraps useQuery. The whole canvas reads from this.
/**
 * @param {() => string} getId reactive id getter (so the key tracks route params)
 */
export function useSlice(getId) {
  return useQuery({
    key: () => SLICE_KEYS.byId(getId()),
    query: () => getSlice(getId()),
  })
}

// 3. writes — mutation factories. Each invalidates the owning slice (exact) on
//    settle so useSlice refetches the authoritative board.
export function useDefineSlice() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ entityId: string, name?: string }} payload */
    mutation: (payload) => http.post('/api/slices', payload),
    async onSettled() {
      await cache.invalidateQueries({ key: SLICE_KEYS.root })
    },
  })
}

export function usePlaceEntity() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ sliceId: string, placedEntityId: string, x: number, y: number }} vars */
    mutation: ({ sliceId, placedEntityId, x, y }) =>
      http.post(`/api/slices/${sliceId}/placements`, { placedEntityId, x, y }),
    async onSettled(_data, _error, { sliceId }) {
      await revalidateSlice(cache, sliceId)
    },
  })
}

export function useMovePlacement() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ sliceId: string, placedId: string, x: number, y: number }} vars */
    mutation: ({ sliceId, placedId, x, y }) =>
      http.put(`/api/slices/${sliceId}/placements/${placedId}`, { x, y }),
    async onSettled(_data, _error, { sliceId }) {
      await revalidateSlice(cache, sliceId)
    },
  })
}

export function useRemovePlacement() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ sliceId: string, placedId: string }} vars */
    mutation: ({ sliceId, placedId }) =>
      http.del(`/api/slices/${sliceId}/placements/${placedId}`),
    async onSettled(_data, _error, { sliceId }) {
      await revalidateSlice(cache, sliceId)
    },
  })
}

export function useDrawRelation() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ sliceId: string, entityId: string, fromId: string, toId: string }} vars */
    mutation: ({ entityId, fromId, toId }) =>
      http.post('/api/relations', { entityId, fromId, toId }),
    async onSettled(_data, _error, { sliceId }) {
      await revalidateSlice(cache, sliceId)
    },
  })
}

export function useDeleteRelation() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ sliceId: string, relationId: string }} vars */
    mutation: ({ relationId }) => http.del(`/api/relations/${relationId}`),
    async onSettled(_data, _error, { sliceId }) {
      await revalidateSlice(cache, sliceId)
    },
  })
}
