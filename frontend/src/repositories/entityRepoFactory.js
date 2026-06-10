// INTERNAL helper for the 7 catalog-entity repositories (LAYER 3). Each entity
// type keeps its own repo file + query keys + docblock ("one repository per
// domain"), but the seven share one CRUD shape — this factory avoids 7×
// copy-paste while keeping every public composable per-type.
//
// Shared backend contract (per type, `resource` = e.g. 'business-facts'):
//   POST   /api/<resource>                 { modelId, entityId, name, <payload> }
//   PUT    /api/<resource>/:id/name        { name }
//   PUT    /api/<resource>/:id/<payloadPath>  payload body (fields/content/…)
//   DELETE /api/<resource>/:id
//   GET    /api/<resource>/:id             → catalog DTO (definition, contextId)
//   (facts only) PUT/DELETE /api/<resource>/:id/context   { contextId }
//
// Invalidation (every mutation): own byId (exact) + the model's catalog list
// (palette/pickers) immediately, then SPACED invalidation of every slice board
// (names/fields/lanes render on canvas) fire-and-forget so saves stay snappy
// while boards converge. Mutation vars therefore ALWAYS carry `modelId`.
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { http } from '@/lib/http'
import { retry404, spacedInvalidate } from '@/lib/projectionLag'
import { CATALOG_KEYS } from '@/repositories/catalogRepository'
import { SLICE_KEYS } from '@/repositories/sliceRepository'
import { CONTEXT_KEYS } from '@/repositories/contextRepository'
import { SCENARIO_KEYS } from '@/repositories/scenarioRepository'

/**
 * @param {object} cfg
 * @param {string} cfg.resource URL segment, e.g. 'business-facts'
 * @param {string} cfg.keyRoot colada key root, e.g. 'businessFact'
 * @param {{ path: string, body: (vars: any) => unknown }} cfg.payload
 *        the type-specific payload route (fields / content / trigger-config /
 *        mapping) and how mutation vars map to its body
 * @param {boolean} [cfg.hasLane] facts only — adds assign/clear context
 */
export function createEntityRepo({ resource, keyRoot, payload, hasLane = false }) {
  const KEYS = {
    root: [keyRoot],
    /** @param {string} id */
    byId: (id) => [keyRoot, id],
  }

  /**
   * Converge views after a catalog write: own doc + palette refetch now AND on
   * a spaced schedule — the immediate refetch usually races the ~50ms async
   * projection (it returns the PRE-write state), so without the spaced
   * follow-ups a just-defined entity never appears. Boards ride the same
   * schedule. Fire-and-forget so saves stay snappy.
   */
  async function settle(cache, { entityId, modelId }) {
    await cache.invalidateQueries({ key: KEYS.byId(entityId), exact: true })
    void spacedInvalidate(cache, KEYS.byId(entityId), { exact: true }).catch(() => {})
    if (modelId) {
      await cache.invalidateQueries({ key: CATALOG_KEYS.byModel(modelId), exact: true })
      void spacedInvalidate(cache, CATALOG_KEYS.byModel(modelId), { exact: true }).catch(() => {})
    }
    void spacedInvalidate(cache, SLICE_KEYS.root).catch(() => {})
    // Catalog writes can flip scenarios' derived outOfSync (e.g. archiving a
    // referenced fact) — converge those reads too (prefix: byId + byModel).
    void spacedInvalidate(cache, SCENARIO_KEYS.root).catch(() => {})
  }

  /**
   * @param {() => string} getId reactive id getter
   * @param {{ enabled?: () => boolean }} [opts] e.g. disable in create mode
   *        (the entity doesn't exist yet — retry404 would spin pointlessly)
   */
  function useEntity(getId, { enabled } = {}) {
    return useQuery({
      key: () => KEYS.byId(getId()),
      // retry404: a just-defined entity may not be projected yet.
      query: () => retry404(() => http.get(`/api/${resource}/${getId()}`)),
      ...(enabled ? { enabled } : {}),
    })
  }

  function useDefine() {
    const cache = useQueryCache()
    return useMutation({
      /** @param {{ modelId: string, entityId: string, name: string }} vars + payload fields */
      mutation: (vars) =>
        http.post(`/api/${resource}`, {
          modelId: vars.modelId,
          entityId: vars.entityId,
          name: vars.name,
          ...payload.body(vars),
        }),
      async onSettled(_d, _e, vars) {
        await settle(cache, vars)
      },
    })
  }

  function useRename() {
    const cache = useQueryCache()
    return useMutation({
      /** @param {{ modelId: string, entityId: string, name: string }} vars */
      mutation: ({ entityId, name }) =>
        http.put(`/api/${resource}/${entityId}/name`, { name }),
      async onSettled(_d, _e, vars) {
        await settle(cache, vars)
      },
    })
  }

  function useUpdatePayload() {
    const cache = useQueryCache()
    return useMutation({
      /** @param {{ modelId: string, entityId: string }} vars + payload fields */
      mutation: (vars) =>
        http.put(`/api/${resource}/${vars.entityId}/${payload.path}`, payload.body(vars)),
      async onSettled(_d, _e, vars) {
        await settle(cache, vars)
      },
    })
  }

  function useArchive() {
    const cache = useQueryCache()
    return useMutation({
      /** @param {{ modelId: string, entityId: string }} vars */
      mutation: ({ entityId }) => http.del(`/api/${resource}/${entityId}`),
      async onSettled(_d, _e, vars) {
        await settle(cache, vars)
      },
    })
  }

  const repo = { KEYS, useEntity, useDefine, useRename, useUpdatePayload, useArchive }

  if (hasLane) {
    // Lane (Context) assignment — facts only (swimlanes.md: only facts carry a
    // lane). Also refreshes the contexts list (its factCount is derived).
    repo.useAssignContext = function useAssignContext() {
      const cache = useQueryCache()
      return useMutation({
        /** @param {{ modelId: string, entityId: string, contextId: string }} vars */
        mutation: ({ entityId, contextId }) =>
          http.put(`/api/${resource}/${entityId}/context`, { contextId }),
        async onSettled(_d, _e, vars) {
          await settle(cache, vars)
          if (vars.modelId)
            void spacedInvalidate(cache, CONTEXT_KEYS.byModel(vars.modelId), { exact: true }).catch(() => {})
        },
      })
    }
    repo.useClearContext = function useClearContext() {
      const cache = useQueryCache()
      return useMutation({
        /** @param {{ modelId: string, entityId: string }} vars */
        mutation: ({ entityId }) => http.del(`/api/${resource}/${entityId}/context`),
        async onSettled(_d, _e, vars) {
          await settle(cache, vars)
          if (vars.modelId)
            void spacedInvalidate(cache, CONTEXT_KEYS.byModel(vars.modelId), { exact: true }).catch(() => {})
        },
      })
    }
  }

  return repo
}
