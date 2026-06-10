// LAYER 3 — external-business-fact repository (catalog entity; yellow, the 4th
// pattern's public-boundary fact). Same shape as internal facts: FIELDS + an
// explicitly assigned LANE (O5 — never auto-assigned at define).
//
// Backend paths: POST /api/external-business-facts {modelId,entityId,name,fields}
// · PUT /:id/name · PUT /:id/fields · PUT/DELETE /:id/context · DELETE /:id ·
// GET /:id.
import { createEntityRepo } from '@/repositories/entityRepoFactory'

const repo = createEntityRepo({
  resource: 'external-business-facts',
  keyRoot: 'externalBusinessFact',
  payload: { path: 'fields', body: ({ fields }) => ({ fields }) },
  hasLane: true,
})

export const EXTERNAL_FACT_KEYS = repo.KEYS
export const useExternalBusinessFact = repo.useEntity
export const useDefineExternalBusinessFact = repo.useDefine
export const useRenameExternalBusinessFact = repo.useRename
export const useUpdateExternalBusinessFactFields = repo.useUpdatePayload
export const useArchiveExternalBusinessFact = repo.useArchive
export const useAssignExternalBusinessFactContext = repo.useAssignContext
export const useClearExternalBusinessFactContext = repo.useClearContext
