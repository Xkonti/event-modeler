// LAYER 3 — translation repository (catalog entity; 4th pattern's
// anti-corruption mapper). Translations carry a MAPPING ({ direction:
// 'inbound'|'outbound', pairs:[{externalField, internalField}] } — G3:
// UpdateTranslationMapping) and sit SINGLE in the trigger slot.
//
// Backend paths: POST /api/translations {modelId,entityId,name,mapping} ·
// PUT /:id/name · PUT /:id/mapping {mapping} · DELETE /:id · GET /:id.
import { createEntityRepo } from '@/repositories/entityRepoFactory'

const repo = createEntityRepo({
  resource: 'translations',
  keyRoot: 'translation',
  payload: { path: 'mapping', body: ({ mapping }) => ({ mapping }) },
})

export const TRANSLATION_KEYS = repo.KEYS
export const useTranslation = repo.useEntity
export const useDefineTranslation = repo.useDefine
export const useRenameTranslation = repo.useRename
export const useUpdateTranslationMapping = repo.useUpdatePayload
export const useArchiveTranslation = repo.useArchive
