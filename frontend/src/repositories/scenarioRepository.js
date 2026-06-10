// LAYER 3 — scenario (GWT/GT) repository. Scenarios anchor on a command (GWT)
// or a read model / automation (GT, no When) and AUTO-SURFACE in every slice
// whose visible entities they reference (F6) — the slice GET embeds them, so
// board convergence rides the ['slices'] prefix invalidation.
//
// Backend paths (build-to contract):
//   GET    /api/scenarios?modelId=…[&entityId=…]
//   GET    /api/scenarios/:id        → doc + derived outOfSync
//   POST   /api/scenarios            { modelId, scenarioId, kind, anchorId,
//                                      given, when?, then }
//   PUT    /api/scenarios/:id        { anchorId, given, when?, then }
//   DELETE /api/scenarios/:id        (archive)
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { http } from '@/lib/http'
import { retry404, spacedInvalidate } from '@/lib/projectionLag'
import { SLICE_KEYS } from '@/repositories/sliceRepository'

export const SCENARIO_KEYS = {
  root: ['scenarios'],
  /** @param {string} modelId */
  byModel: (modelId) => ['scenarios', 'byModel', modelId],
  /** @param {string} id */
  byId: (id) => ['scenarios', id],
}

/** @param {() => string} getModelId reactive model-id getter */
export function useScenarios(getModelId) {
  return useQuery({
    key: () => SCENARIO_KEYS.byModel(getModelId()),
    query: () =>
      http.get(`/api/scenarios?modelId=${encodeURIComponent(getModelId())}`),
  })
}

/** @param {() => string} getId reactive scenario-id getter (includes outOfSync) */
export function useScenario(getId) {
  return useQuery({
    key: () => SCENARIO_KEYS.byId(getId()),
    query: () => retry404(() => http.get(`/api/scenarios/${getId()}`)),
  })
}

async function settle(cache, { modelId, scenarioId }) {
  if (scenarioId)
    await cache.invalidateQueries({ key: SCENARIO_KEYS.byId(scenarioId), exact: true })
  if (modelId) {
    await cache.invalidateQueries({ key: SCENARIO_KEYS.byModel(modelId), exact: true })
    // Immediate refetch races the async projection → spaced follow-ups too.
    void spacedInvalidate(cache, SCENARIO_KEYS.byModel(modelId), { exact: true }).catch(() => {})
  }
  void spacedInvalidate(cache, SLICE_KEYS.root).catch(() => {})
}

export function useDefineScenario() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, scenarioId: string, kind: 'GWT'|'GT', anchorId: string, given: object[], when?: object, then: object }} payload */
    mutation: (payload) => http.post('/api/scenarios', payload),
    async onSettled(_d, _e, vars) {
      await settle(cache, vars)
    },
  })
}

export function useUpdateScenario() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, scenarioId: string, anchorId: string, given: object[], when?: object, then: object }} vars */
    mutation: ({ scenarioId, anchorId, given, when, then }) =>
      http.put(`/api/scenarios/${scenarioId}`, {
        anchorId,
        given,
        ...(when !== undefined ? { when } : {}),
        then,
      }),
    async onSettled(_d, _e, vars) {
      await settle(cache, vars)
    },
  })
}

export function useArchiveScenario() {
  const cache = useQueryCache()
  return useMutation({
    /** @param {{ modelId: string, scenarioId: string }} vars */
    mutation: ({ scenarioId }) => http.del(`/api/scenarios/${scenarioId}`),
    async onSettled(_d, _e, vars) {
      await settle(cache, vars)
    },
  })
}
