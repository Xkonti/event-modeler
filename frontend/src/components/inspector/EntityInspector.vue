<script setup>
// VIEW (inspector, W5/6) — the type-parameterized entity inspector. CREATE ==
// edit-on-a-fresh-entity: in create mode the first Save issues Define<Type>
// with the pre-generated entityId (nothing persisted before that), then places
// the entity if the draft came from a ghost slot (placeIntoSliceId), then
// flips to selection. IMPORTANT: the parent re-keys this component per
// entity+type, so the per-type composables below are stable for one instance.
//
// 409 dup-name UX (decided): names are unique per model (F1b). On a Define 409
// we look the colliding entry up in the catalog cache by normalized name —
// hit → inline error + "Use existing <name> instead?" (places/select the
// existing identity: reuse-by-name is the easy path); miss (projection lag or
// a true concurrency conflict) → generic inline conflict.
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ENTITY_REPOS } from '@/repositories/entityRepos'
import { usePlaceEntity } from '@/repositories/sliceRepository'
import { useDefineContext } from '@/repositories/contextRepository'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUiStore } from '@/stores/ui'
import { normalizeName } from '@/lib/naming'
import { reportMutationError } from '@/lib/errors'
import { HttpError } from '@/lib/http'
import Button from '@/components/ui/Button.vue'
import FormField from '@/components/ui/FormField.vue'
import Input from '@/components/ui/Input.vue'
import FieldsEditor from '@/components/inspector/FieldsEditor.vue'
import LaneControl from '@/components/inspector/LaneControl.vue'
import AutomationTriggerEditor from '@/components/inspector/AutomationTriggerEditor.vue'
import TranslationMappingEditor from '@/components/inspector/TranslationMappingEditor.vue'

const props = defineProps({
  modelId: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  mode: { type: String, required: true }, // 'create' | 'edit'
  placeIntoSliceId: { type: String, default: null },
  catalog: { type: Array, default: () => [] },
  contexts: { type: Array, default: () => [] },
})

const router = useRouter()
const ui = useUiStore()
const workspace = useWorkspaceStore()

const repo = ENTITY_REPOS[props.entityType]
const isCreate = computed(() => props.mode === 'create')

// --- composables (stable per instance — parent re-keys on entity change) ----
const entityQuery = repo.useEntity(() => props.entityId, {
  enabled: () => !isCreate.value,
})
const define = repo.useDefine()
const rename = repo.useRename()
const updatePayload = repo.useUpdatePayload()
const archive = repo.useArchive()
const placeEntity = usePlaceEntity()
const defineContext = useDefineContext()
const assignContext = repo.hasLane ? repo.useAssignContext() : null
const clearContext = repo.hasLane ? repo.useClearContext() : null

const entity = computed(() => (isCreate.value ? null : entityQuery.data.value))

// --- local form state ---------------------------------------------------------
const name = ref('')
const nameError = ref('')
const existingMatch = ref(null) // catalog entry colliding on normalized name
const fields = ref([])
const content = ref('')
const triggerConfig = ref({ triggerType: 'interaction' })
const mapping = ref({ direction: 'inbound', pairs: [] })
const saving = ref(false)

watch(
  entity,
  (e) => {
    if (!e) return
    name.value = e.name ?? ''
    const def = e.definition ?? {}
    if (def.fields) fields.value = def.fields.map((f) => ({ ...f }))
    if (def.content !== undefined) content.value = def.content
    if (def.triggerConfig) triggerConfig.value = { ...def.triggerConfig }
    if (def.mapping) mapping.value = { direction: def.mapping.direction, pairs: (def.mapping.pairs ?? []).map((p) => ({ ...p })) }
  },
  { immediate: true },
)

const cleanFields = () =>
  fields.value
    .map((f) => ({ fieldName: f.fieldName.trim(), fieldType: f.fieldType.trim() }))
    .filter((f) => f.fieldName)

const payloadVars = () => {
  switch (repo.payloadKind) {
    case 'fields':
      return { fields: cleanFields() }
    case 'content':
      return { content: content.value }
    case 'triggerConfig':
      return { triggerConfig: triggerConfig.value }
    case 'mapping':
      return { mapping: mapping.value }
    default:
      return {}
  }
}

// --- save ----------------------------------------------------------------------
async function onSave() {
  const trimmed = name.value.trim()
  nameError.value = ''
  existingMatch.value = null
  if (!trimmed) {
    nameError.value = 'Name is required.'
    return
  }
  saving.value = true
  try {
    if (isCreate.value) {
      await define.mutateAsync({
        modelId: props.modelId,
        entityId: props.entityId,
        name: trimmed,
        ...payloadVars(),
      })
      if (props.placeIntoSliceId) {
        // The placement pre-check reads the async catalog — a just-defined
        // entity 422s ("not found") until its projection lands. Retry briefly.
        try {
          for (let attempt = 0; ; attempt++) {
            try {
              await placeEntity.mutateAsync({
                sliceId: props.placeIntoSliceId,
                placedEntityId: props.entityId,
              })
              break
            } catch (err) {
              const transient =
                err instanceof HttpError && err.status === 422 && attempt < 8
              if (!transient) throw err
              await new Promise((r) => setTimeout(r, 250))
            }
          }
        } catch (err) {
          reportMutationError(ui, router, err, 'Created the entity, but could not place it.')
        }
      }
      workspace.select(props.entityType === 'slice' ? 'slice' : 'entity', props.entityId)
    } else {
      // Edit: rename only when changed; payload saved separately below.
      if (trimmed !== entity.value?.name) {
        await rename.mutateAsync({
          modelId: props.modelId,
          entityId: props.entityId,
          name: trimmed,
        })
      }
      await updatePayload.mutateAsync({
        modelId: props.modelId,
        entityId: props.entityId,
        ...payloadVars(),
      })
    }
  } catch (err) {
    if (err instanceof HttpError && err.status === 409) {
      const collision = props.catalog.find(
        (e) => normalizeName(e.name) === normalizeName(trimmed) && e._id !== props.entityId,
      )
      if (collision) {
        existingMatch.value = collision
        nameError.value = `"${collision.name}" already exists in this model.`
      } else {
        nameError.value = 'That name conflicts with an existing entity (or a concurrent change).'
      }
    } else {
      reportMutationError(ui, router, err, 'Could not save the entity.')
    }
  } finally {
    saving.value = false
  }
}

// "Use existing" — reuse the colliding identity instead of creating a twin:
// place it if this draft came from a ghost slot, then select it.
async function useExisting() {
  const target = existingMatch.value
  if (!target) return
  if (props.placeIntoSliceId) {
    try {
      await placeEntity.mutateAsync({
        sliceId: props.placeIntoSliceId,
        placedEntityId: target._id,
      })
    } catch (err) {
      reportMutationError(ui, router, err, 'Could not place the existing entity.')
      return
    }
  }
  workspace.select('entity', target._id)
}

// --- lane ------------------------------------------------------------------------
const laneBusy = ref(false)
async function onAssignLane(contextId) {
  laneBusy.value = true
  try {
    await assignContext.mutateAsync({ modelId: props.modelId, entityId: props.entityId, contextId })
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not assign the lane.')
  } finally {
    laneBusy.value = false
  }
}
async function onClearLane() {
  laneBusy.value = true
  try {
    await clearContext.mutateAsync({ modelId: props.modelId, entityId: props.entityId })
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not clear the lane.')
  } finally {
    laneBusy.value = false
  }
}
async function onCreateLane(laneName) {
  laneBusy.value = true
  const contextId = crypto.randomUUID()
  try {
    await defineContext.mutateAsync({ modelId: props.modelId, contextId, name: laneName })
    // The assignment pre-check reads the async `contexts` projection — a
    // just-defined lane 422s until it lands. Retry briefly (same projection-lag
    // accommodation as retry404, but the signal here is a 422).
    for (let attempt = 0; ; attempt++) {
      try {
        await assignContext.mutateAsync({
          modelId: props.modelId,
          entityId: props.entityId,
          contextId,
        })
        break
      } catch (err) {
        const transient = err instanceof HttpError && err.status === 422 && attempt < 8
        if (!transient) throw err
        await new Promise((r) => setTimeout(r, 250))
      }
    }
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not create the lane.')
  } finally {
    laneBusy.value = false
  }
}

// --- archive -----------------------------------------------------------------------
async function onArchive() {
  if (!window.confirm(`Archive "${entity.value?.name ?? name.value}"? Its placements and relations are cleaned up.`)) return
  try {
    await archive.mutateAsync({ modelId: props.modelId, entityId: props.entityId })
    workspace.clearSelection()
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not archive the entity.')
  }
}
</script>

<template>
  <div data-testid="entity-inspector" class="space-y-4 p-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-gray-900">
        {{ isCreate ? `New ${repo.label.toLowerCase()}` : repo.label }}
      </h2>
      <span
        class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        :class="entityType === 'externalBusinessFact' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'"
      >
        {{ repo.label }}
      </span>
    </div>

    <FormField label="Name" :error="nameError" v-slot="{ id }">
      <Input :id="id" v-model="name" data-testid="inspector-name" placeholder="Domain-meaningful name" />
    </FormField>
    <Button
      v-if="existingMatch"
      data-testid="use-existing"
      variant="secondary"
      @click="useExisting"
    >
      Use existing “{{ existingMatch.name }}” instead
    </Button>

    <FieldsEditor v-if="repo.payloadKind === 'fields'" v-model:fields="fields" />

    <div v-else-if="repo.payloadKind === 'content'" class="space-y-1.5">
      <p class="text-sm font-medium text-gray-700">Content</p>
      <textarea
        data-testid="wireframe-content"
        v-model="content"
        rows="8"
        placeholder="Rough sketch / layout notes (ASCII art welcome)"
        class="w-full rounded-md border border-gray-300 px-2 py-1 font-mono text-xs focus:border-brand focus:outline-none"
      />
    </div>

    <AutomationTriggerEditor
      v-else-if="repo.payloadKind === 'triggerConfig'"
      v-model:config="triggerConfig"
      :catalog="catalog"
    />

    <TranslationMappingEditor
      v-else-if="repo.payloadKind === 'mapping'"
      v-model:mapping="mapping"
    />

    <LaneControl
      v-if="repo.hasLane && !isCreate"
      :contexts="contexts"
      :context-id="entity?.contextId ?? null"
      :busy="laneBusy"
      @assign="onAssignLane"
      @clear="onClearLane"
      @create-and-assign="onCreateLane"
    />
    <p v-else-if="repo.hasLane && isCreate" class="text-xs text-gray-400">
      Lane can be assigned after the first save.
    </p>

    <div class="flex items-center gap-2 border-t border-gray-200 pt-3">
      <Button data-testid="inspector-save" :disabled="saving" @click="onSave">
        {{ saving ? 'Saving…' : 'Save' }}
      </Button>
      <Button
        v-if="!isCreate"
        data-testid="inspector-archive"
        variant="ghost"
        @click="onArchive"
      >
        Archive
      </Button>
      <Button
        v-if="isCreate"
        variant="ghost"
        data-testid="inspector-cancel"
        @click="workspace.clearDraft()"
      >
        Cancel
      </Button>
    </div>
  </div>
</template>
