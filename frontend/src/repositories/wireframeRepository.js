// LAYER 3 — wireframe repository (catalog entity). Wireframes carry CONTENT (a
// rough layout/sketch string, not fields) and stack in the trigger slot
// (multiple per slice, slot-numbered — D2).
//
// Backend paths: POST /api/wireframes {modelId,entityId,name,content} ·
// PUT /:id/name · PUT /:id/content {content} · DELETE /:id · GET /:id.
import { createEntityRepo } from '@/repositories/entityRepoFactory'

const repo = createEntityRepo({
  resource: 'wireframes',
  keyRoot: 'wireframe',
  payload: { path: 'content', body: ({ content }) => ({ content }) },
})

export const WIREFRAME_KEYS = repo.KEYS
export const useWireframe = repo.useEntity
export const useDefineWireframe = repo.useDefine
export const useRenameWireframe = repo.useRename
export const useUpdateWireframeContent = repo.useUpdatePayload
export const useArchiveWireframe = repo.useArchive
