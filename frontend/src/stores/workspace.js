// LAYER 4 — workspace store: CLIENT-truth only for the W3 screen (selection,
// inspector draft, presentation toggles). Server data stays in the colada cache
// (repositories) — never mirrored here. Selection is the single source the
// inspector + canvas highlight read; the canvas emits intents, Workspace.vue
// writes here.
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useWorkspaceStore = defineStore('workspace', () => {
  /**
   * What the inspector shows / the canvas highlights. `kind` is one of
   * 'entity' | 'relation' | 'scenario' | 'slice' (or null = nothing selected).
   * @type {import('vue').Ref<{ kind: string, id: string } | null>}
   */
  const selection = ref(null)

  /**
   * Inspector create-mode state — create == edit-on-a-fresh-entity, nothing
   * persists until the first save (Define<Type>). `entityId` is pre-generated
   * client-side so a failed define can be retried with the same id.
   * `placeIntoSliceId` makes the inspector place the entity after defining
   * (the "create new <type>" path of the place dialog), `placeKind` is an
   * optional scenario kind for the add-scenario path.
   * @type {import('vue').Ref<{ entityType: string, entityId: string, placeIntoSliceId?: string } | null>}
   */
  const draft = ref(null)

  // Presentation toggles (layers.md) — never persisted to the backend.
  const lanesVisible = ref(false) // off by default in early planning (swimlanes.md)
  const fieldsVisible = ref(true) // detail layers default ON (layers.md)
  const validationPanelOpen = ref(false)

  const selectedEntityId = computed(() =>
    selection.value?.kind === 'entity' ? selection.value.id : null,
  )
  const selectedRelationId = computed(() =>
    selection.value?.kind === 'relation' ? selection.value.id : null,
  )
  const selectedScenarioId = computed(() =>
    selection.value?.kind === 'scenario' ? selection.value.id : null,
  )
  const selectedSliceId = computed(() =>
    selection.value?.kind === 'slice' ? selection.value.id : null,
  )

  /** @param {string} kind @param {string} id */
  function select(kind, id) {
    draft.value = null
    selection.value = { kind, id }
  }
  function clearSelection() {
    selection.value = null
  }

  /** @param {{ entityType: string, entityId: string, placeIntoSliceId?: string }} d */
  function startDraft(d) {
    selection.value = null
    draft.value = d
  }
  function clearDraft() {
    draft.value = null
  }

  function toggleLanes() {
    lanesVisible.value = !lanesVisible.value
  }
  function toggleFields() {
    fieldsVisible.value = !fieldsVisible.value
  }

  return {
    selection,
    draft,
    lanesVisible,
    fieldsVisible,
    validationPanelOpen,
    selectedEntityId,
    selectedRelationId,
    selectedScenarioId,
    selectedSliceId,
    select,
    clearSelection,
    startDraft,
    clearDraft,
    toggleLanes,
    toggleFields,
  }
})
