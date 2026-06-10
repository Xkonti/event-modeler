// LAYER 3 — command repository (catalog entity). Commands carry FIELDS and are
// LANE-AGNOSTIC (their tie to a stream is the produces-arrow to a fact).
//
// Backend paths: POST /api/commands {modelId,entityId,name,fields} ·
// PUT /:id/name · PUT /:id/fields {fields} · DELETE /:id · GET /:id.
import { createEntityRepo } from '@/repositories/entityRepoFactory'

const repo = createEntityRepo({
  resource: 'commands',
  keyRoot: 'command',
  payload: { path: 'fields', body: ({ fields }) => ({ fields }) },
})

export const COMMAND_KEYS = repo.KEYS
export const useCommand = repo.useEntity
export const useDefineCommand = repo.useDefine
export const useRenameCommand = repo.useRename
export const useUpdateCommandFields = repo.useUpdatePayload
export const useArchiveCommand = repo.useArchive
