<script setup>
// W3 — Modeler Workspace: 3-pane shell (palette | canvas | inspector) + topbar.
// THE single cross-domain intent→repo hub: the canvas emits intents, this page
// translates them into repository calls / inspector drafts. Selection + drafts
// live in the workspace store; relation/scenario drafts are local (they exist
// only while this page does).
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUiStore } from '@/stores/ui'
import { useModel, fetchModelValidation, exportModel } from '@/repositories/modelRepository'
import { useCatalog } from '@/repositories/catalogRepository'
import { useContexts } from '@/repositories/contextRepository'
import {
  useModelSlices,
  useDefineSlice,
  useRenameSlice,
  useArchiveSlice,
  usePlaceEntity,
} from '@/repositories/sliceRepository'
import { validKindsForPair } from '@/lib/relationKinds'
import { reportMutationError } from '@/lib/errors'
import { downloadJson } from '@/lib/download'
import WorkspaceTopbar from '@/components/workspace/WorkspaceTopbar.vue'
import PaletteSidebar from '@/components/workspace/PaletteSidebar.vue'
import PlaceEntityDialog from '@/components/workspace/PlaceEntityDialog.vue'
import ModelCanvas from '@/components/canvas/ModelCanvas.vue'
import InspectorPane from '@/components/inspector/InspectorPane.vue'
import ValidationPanel from '@/components/workspace/ValidationPanel.vue'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const workspace = useWorkspaceStore()

const modelId = computed(() => route.params.id)

// --- reads -------------------------------------------------------------------
const { data: model } = useModel(() => modelId.value)
const { data: slices } = useModelSlices(() => modelId.value)
const { data: catalog } = useCatalog(() => modelId.value)
const { data: contexts } = useContexts(() => modelId.value)

// On-demand validation state (A2) — plain fetch, always fresh.
const validationFindings = ref([])
const validationPending = ref(false)
async function runValidation() {
  validationPending.value = true
  try {
    const result = await fetchModelValidation(modelId.value)
    validationFindings.value = result.findings ?? []
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not check the model.')
  } finally {
    validationPending.value = false
  }
}

const sliceIds = computed(() => (slices.value ?? []).map((s) => s._id))

// --- mutations ---------------------------------------------------------------
const defineSlice = useDefineSlice()
const renameSlice = useRenameSlice()
const archiveSlice = useArchiveSlice()
const placeEntity = usePlaceEntity()

// --- inspector drafts beyond the store's entity draft -------------------------
// Relation draft: set by the canvas connect gesture, consumed by the W7
// inspector. `kinds` = valid kinds for the pair (today exactly one).
const relationDraft = ref(null) // { fromId, toId, kinds } | null
// Scenario draft: set by the strip's +GWT/+GT, consumed by the W8 editor.
const scenarioDraft = ref(null) // { sliceId, kind } | null

function clearDrafts() {
  relationDraft.value = null
  scenarioDraft.value = null
}

// --- canvas intent handlers ----------------------------------------------------
function onSelectEntity(entityId) {
  clearDrafts()
  workspace.select('entity', entityId)
}
function onSelectRelation(relationId) {
  clearDrafts()
  workspace.select('relation', relationId)
}
function onSelectScenario(scenarioId) {
  clearDrafts()
  workspace.select('scenario', scenarioId)
}
function onClearSelection() {
  clearDrafts()
  workspace.clearSelection()
}

// + add slice → DefineSlice with a client-generated id.
async function onAddSlice() {
  try {
    await defineSlice.mutateAsync({
      modelId: modelId.value,
      sliceId: crypto.randomUUID(),
      name: 'Untitled slice',
    })
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not create the slice.')
  }
}

async function onRenameSlice({ sliceId, name }) {
  try {
    await renameSlice.mutateAsync({ modelId: modelId.value, sliceId, name })
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not rename the slice.')
  }
}

async function onArchiveSlice({ sliceId }) {
  try {
    await archiveSlice.mutateAsync({ modelId: modelId.value, sliceId })
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not archive the slice.')
  }
}

// Ghost-slot click → place dialog scoped to that role.
const placeDialog = ref(null) // { sliceId, role } | null
function onAddEntity({ sliceId, role }) {
  placeDialog.value = { sliceId, role }
}

async function onPlace({ sliceId, placedEntityId }) {
  try {
    await placeEntity.mutateAsync({ sliceId, placedEntityId })
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not place the entity.')
  }
}

// Connect gesture → W7 relation draft (or an immediate invalid-pair banner —
// the same rule the backend enforces with 422, checked client-side first).
const catalogById = computed(() => new Map((catalog.value ?? []).map((e) => [e._id, e])))
function onDrawRelation({ fromId, toId }) {
  const from = catalogById.value.get(fromId)
  const to = catalogById.value.get(toId)
  if (!from || !to) {
    ui.pushBanner('error', 'Could not resolve both ends of the relation.')
    return
  }
  const kinds = validKindsForPair(from.entityType, to.entityType)
  if (kinds.length === 0) {
    ui.pushBanner('error', 'That relation is not allowed between these entity types.')
    return
  }
  workspace.clearSelection()
  scenarioDraft.value = null
  relationDraft.value = { fromId, toId, kinds }
}

function onAddScenario({ sliceId, kind }) {
  workspace.clearSelection()
  relationDraft.value = null
  scenarioDraft.value = { sliceId, kind }
}

// --- topbar ------------------------------------------------------------------
function onCheckModel() {
  workspace.validationPanelOpen = true
  void runValidation()
}

const exporting = ref(false)
async function onExport() {
  exporting.value = true
  try {
    const data = await exportModel(modelId.value)
    const slug = (model.value?.name ?? 'model').trim().toLowerCase().replace(/\s+/g, '-')
    downloadJson(`${slug}.event-model.json`, data)
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not export the model.')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div data-testid="workspace" class="flex h-full flex-col">
    <WorkspaceTopbar
      :model-name="model?.name ?? ''"
      :exporting="exporting"
      @check-model="onCheckModel"
      @export="onExport"
    />

    <div class="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)_22rem]">
      <PaletteSidebar :catalog="catalog ?? []" />

      <ModelCanvas
        :slice-ids="sliceIds"
        :lanes-on="workspace.lanesVisible"
        :fields-on="workspace.fieldsVisible"
        :contexts="contexts ?? []"
        :selected-entity-id="workspace.selectedEntityId"
        :selected-relation-id="workspace.selectedRelationId"
        @select-entity="onSelectEntity"
        @select-relation="onSelectRelation"
        @select-scenario="onSelectScenario"
        @clear-selection="onClearSelection"
        @add-entity="onAddEntity"
        @add-scenario="onAddScenario"
        @add-slice="onAddSlice"
        @draw-relation="onDrawRelation"
        @rename-slice="onRenameSlice"
        @archive-slice="onArchiveSlice"
      />

      <div class="min-h-0 overflow-y-auto border-l border-gray-200 bg-white">
        <ValidationPanel
          v-if="workspace.validationPanelOpen"
          :model-id="modelId"
          :findings="validationFindings"
          :pending="validationPending"
          @recheck="runValidation()"
          @close="workspace.validationPanelOpen = false"
        />
        <InspectorPane
          v-else
          :model-id="modelId"
          :catalog="catalog ?? []"
          :contexts="contexts ?? []"
          :relation-draft="relationDraft"
          :scenario-draft="scenarioDraft"
          @close-relation-draft="relationDraft = null"
          @close-scenario-draft="scenarioDraft = null"
        />
      </div>
    </div>

    <PlaceEntityDialog
      :open="placeDialog !== null"
      :role="placeDialog?.role ?? null"
      :slice-id="placeDialog?.sliceId ?? null"
      :catalog="catalog ?? []"
      @update:open="(v) => !v && (placeDialog = null)"
      @place="onPlace"
    />
  </div>
</template>
