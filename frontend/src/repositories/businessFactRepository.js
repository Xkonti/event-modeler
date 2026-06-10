// LAYER 3 — business-fact repository (catalog entity). Facts carry FIELDS
// (free-text types, O4) and a LANE (contextId — swimlanes.md: only facts have
// one). Shape shared with the other 6 entity repos via entityRepoFactory.
//
// Backend paths: POST /api/business-facts {modelId,entityId,name,fields} ·
// PUT /:id/name · PUT /:id/fields {fields} · PUT/DELETE /:id/context
// {contextId} · DELETE /:id · GET /:id.
import { createEntityRepo } from '@/repositories/entityRepoFactory'

const repo = createEntityRepo({
  resource: 'business-facts',
  keyRoot: 'businessFact',
  payload: { path: 'fields', body: ({ fields }) => ({ fields }) },
  hasLane: true,
})

export const FACT_KEYS = repo.KEYS
export const useBusinessFact = repo.useEntity
export const useDefineBusinessFact = repo.useDefine
export const useRenameBusinessFact = repo.useRename
export const useUpdateBusinessFactFields = repo.useUpdatePayload
export const useArchiveBusinessFact = repo.useArchive
export const useAssignBusinessFactContext = repo.useAssignContext
export const useClearBusinessFactContext = repo.useClearContext
