// LAYER 3 — read-model repository (catalog entity). Read models carry FIELDS,
// are LANE-AGNOSTIC (multi-stream by nature), ride the command band on canvas
// and wire UP to the trigger (displayedBy).
//
// Backend paths: POST /api/read-models {modelId,entityId,name,fields,mode?} ·
// PUT /:id/name · PUT /:id/fields {fields, mode?} · DELETE /:id · GET /:id.
// `mode` (F7): 'projected' (default) | 'live' — live read models are assembled
// from other read models and exempt from the A3 source check.
import { createEntityRepo } from '@/repositories/entityRepoFactory'

const repo = createEntityRepo({
  resource: 'read-models',
  keyRoot: 'readModel',
  payload: {
    path: 'fields',
    body: ({ fields, mode }) => ({ fields, ...(mode ? { mode } : {}) }),
  },
})

export const READ_MODEL_KEYS = repo.KEYS
export const useReadModel = repo.useEntity
export const useDefineReadModel = repo.useDefine
export const useRenameReadModel = repo.useRename
export const useUpdateReadModelFields = repo.useUpdatePayload
export const useArchiveReadModel = repo.useArchive
