// LAYER 3 — automation repository (catalog entity). Automations carry a
// TRIGGER CONFIG ({ triggerType: 'fact'|'timer'|'interaction',
// monitoredReadModelId?, issuedCommandId? } — G3: ReconfigureAutomation, no
// generic fields) and sit SINGLE in the trigger slot.
//
// Backend paths: POST /api/automations {modelId,entityId,name,triggerConfig} ·
// PUT /:id/name · PUT /:id/trigger-config {triggerConfig} · DELETE /:id · GET /:id.
import { createEntityRepo } from '@/repositories/entityRepoFactory'

const repo = createEntityRepo({
  resource: 'automations',
  keyRoot: 'automation',
  payload: { path: 'trigger-config', body: ({ triggerConfig }) => ({ triggerConfig }) },
})

export const AUTOMATION_KEYS = repo.KEYS
export const useAutomation = repo.useEntity
export const useDefineAutomation = repo.useDefine
export const useRenameAutomation = repo.useRename
export const useReconfigureAutomation = repo.useUpdatePayload
export const useArchiveAutomation = repo.useArchive
