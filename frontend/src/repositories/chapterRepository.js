// LAYER 3 — chapter repository (C1). Chapters are the single-level organizing
// band above the slice timeline (es-book ch 18); user-named, per-model, own
// name namespace. Slice→chapter ASSIGNMENT rides the slice stream, so the
// assign/clear mutations live on the slice URLs and invalidate the slice list
// (which carries each slice's chapterId for the band).
//
// Backend paths (build-to contract):
//   GET    /api/models/:id/chapters    → [{ _id, name }]  (creation order = band order)
//   POST   /api/chapters               { modelId, chapterId, name }
//   PUT    /api/chapters/:id/name      { name }
//   DELETE /api/chapters/:id
//   PUT    /api/slices/:id/chapter     { chapterId }     (422 until projections land)
//   DELETE /api/slices/:id/chapter
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { http } from '@/lib/http'
import { spacedInvalidate } from '@/lib/projectionLag'
import { SLICE_KEYS } from '@/repositories/sliceRepository'

export const CHAPTER_KEYS = {
  root: ['chapters'],
  /** @param {string} modelId */
  byModel: (modelId) => ['chapters', modelId],
}

/** @param {() => string} getModelId reactive model-id getter */
export function useModelChapters(getModelId) {
  return useQuery({
    key: () => CHAPTER_KEYS.byModel(getModelId()),
    query: () => http.get(`/api/models/${encodeURIComponent(getModelId())}/chapters`),
  })
}

/** Converge the band + the slice list (chapterId rides it) after any chapter write. */
async function settleChapters(cache, modelId) {
  await cache.invalidateQueries({ key: CHAPTER_KEYS.byModel(modelId), exact: true })
  void spacedInvalidate(cache, CHAPTER_KEYS.byModel(modelId), { exact: true }).catch(() => {})
  void spacedInvalidate(cache, SLICE_KEYS.listByModel(modelId), { exact: true }).catch(() => {})
}

export function useDefineChapter() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, chapterId: string, name: string }} payload */
    mutation: (payload) => http.post('/api/chapters', payload),
    async onSettled(_d, _e, { modelId }) {
      await settleChapters(cache, modelId)
    },
  })
}

export function useRenameChapter() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, chapterId: string, name: string }} vars */
    mutation: ({ chapterId, name }) => http.put(`/api/chapters/${chapterId}/name`, { name }),
    async onSettled(_d, _e, { modelId }) {
      await settleChapters(cache, modelId)
    },
  })
}

export function useArchiveChapter() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, chapterId: string }} vars */
    mutation: ({ chapterId }) => http.del(`/api/chapters/${chapterId}`),
    async onSettled(_d, _e, { modelId }) {
      await settleChapters(cache, modelId)
    },
  })
}

export function useAssignSliceChapter() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, sliceId: string, chapterId: string }} vars */
    mutation: ({ sliceId, chapterId }) =>
      http.put(`/api/slices/${sliceId}/chapter`, { chapterId }),
    async onSettled(_d, _e, { modelId }) {
      // The slice list + boards carry chapterId; converge both.
      await cache.invalidateQueries({ key: SLICE_KEYS.listByModel(modelId), exact: true })
      void spacedInvalidate(cache, SLICE_KEYS.root).catch(() => {})
    },
  })
}

export function useClearSliceChapter() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, sliceId: string }} vars */
    mutation: ({ sliceId }) => http.del(`/api/slices/${sliceId}/chapter`),
    async onSettled(_d, _e, { modelId }) {
      await cache.invalidateQueries({ key: SLICE_KEYS.listByModel(modelId), exact: true })
      void spacedInvalidate(cache, SLICE_KEYS.root).catch(() => {})
    },
  })
}
