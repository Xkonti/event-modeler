<script setup>
// VIEW (inspector, W7) — relation draft + edit. DRAFT mode: the canvas connect
// gesture landed on a VALID type pair (Workspace pre-checked the 11-pair
// table); the kind dropdown offers every valid kind for the pair (today
// exactly one, preselected) and Save issues DrawRelation with a client-
// generated relationId. The kind is STORED (F4), never derived. EDIT mode:
// selected edge — kind + meta note editable, Remove deletes (the backend
// prompts nothing; dependent scenarios just go out-of-sync and get flagged).
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  useRelation,
  useDrawRelation,
  useUpdateRelation,
  useDeleteRelation,
} from '@/repositories/relationRepository'
import { validKindsForPair } from '@/lib/relationKinds'
import { reportMutationError } from '@/lib/errors'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUiStore } from '@/stores/ui'
import { HttpError } from '@/lib/http'
import Button from '@/components/ui/Button.vue'

const props = defineProps({
  modelId: { type: String, required: true },
  // DRAFT mode: { fromId, toId, kinds } — null in edit mode.
  draft: { type: Object, default: null },
  // EDIT mode: the selected relation id — null in draft mode.
  relationId: { type: String, default: null },
  catalog: { type: Array, default: () => [] },
})
const emit = defineEmits(['close-draft'])

const router = useRouter()
const ui = useUiStore()
const workspace = useWorkspaceStore()

const isDraft = computed(() => props.draft !== null)

const relationQuery = useRelation(() => props.relationId ?? '', {
  enabled: () => !isDraft.value && !!props.relationId,
})
const relation = computed(() => (isDraft.value ? null : relationQuery.data.value))

const drawRelation = useDrawRelation()
const updateRelation = useUpdateRelation()
const deleteRelation = useDeleteRelation()

const byId = computed(() => new Map(props.catalog.map((e) => [e._id, e])))
const fromId = computed(() => (isDraft.value ? props.draft.fromId : relation.value?.fromId))
const toId = computed(() => (isDraft.value ? props.draft.toId : relation.value?.toId))
const fromEntity = computed(() => byId.value.get(fromId.value))
const toEntity = computed(() => byId.value.get(toId.value))

// Kind options: draft carries them; edit recomputes from the endpoint types.
const kinds = computed(() => {
  if (isDraft.value) return props.draft.kinds
  if (!fromEntity.value || !toEntity.value) return relation.value ? [relation.value.kind] : []
  return validKindsForPair(fromEntity.value.entityType, toEntity.value.entityType)
})

const kind = ref('')
const note = ref('')
const saving = ref(false)

watch(
  [() => props.draft, relation],
  () => {
    if (isDraft.value) {
      kind.value = props.draft.kinds[0] ?? ''
      note.value = ''
    } else if (relation.value) {
      kind.value = relation.value.kind
      note.value = relation.value.meta?.note ?? ''
    }
  },
  { immediate: true },
)

async function onSave() {
  saving.value = true
  const meta = note.value.trim() ? { note: note.value.trim() } : undefined
  try {
    if (isDraft.value) {
      const relationId = crypto.randomUUID()
      await drawRelation.mutateAsync({
        modelId: props.modelId,
        relationId,
        fromId: props.draft.fromId,
        toId: props.draft.toId,
        kind: kind.value,
        ...(meta ? { meta } : {}),
      })
      emit('close-draft')
      workspace.select('relation', relationId)
    } else {
      await updateRelation.mutateAsync({
        relationId: props.relationId,
        kind: kind.value,
        ...(meta !== undefined ? { meta } : { meta: {} }),
      })
    }
  } catch (err) {
    if (err instanceof HttpError && err.status === 409) {
      ui.pushBanner('error', 'That relation already exists.')
    } else if (err instanceof HttpError && err.status === 422) {
      ui.pushBanner('error', err.message || 'That relation is not allowed.')
    } else {
      reportMutationError(ui, router, err, 'Could not save the relation.')
    }
  } finally {
    saving.value = false
  }
}

async function onRemove() {
  if (!window.confirm('Remove this relation? Scenarios referencing it will be flagged out-of-sync.')) return
  try {
    await deleteRelation.mutateAsync({ relationId: props.relationId })
    workspace.clearSelection()
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not remove the relation.')
  }
}
</script>

<template>
  <div data-testid="relation-inspector" class="space-y-4 p-4">
    <h2 class="text-sm font-semibold text-gray-900">
      {{ isDraft ? 'New relation' : 'Relation' }}
    </h2>

    <dl class="space-y-1 text-sm">
      <div class="flex gap-2">
        <dt class="w-12 text-gray-500">From</dt>
        <dd data-testid="relation-from" class="font-medium text-gray-900">
          {{ fromEntity?.name ?? fromId }}
          <span class="ml-1 text-xs text-gray-400">{{ fromEntity?.entityType }}</span>
        </dd>
      </div>
      <div class="flex gap-2">
        <dt class="w-12 text-gray-500">To</dt>
        <dd data-testid="relation-to" class="font-medium text-gray-900">
          {{ toEntity?.name ?? toId }}
          <span class="ml-1 text-xs text-gray-400">{{ toEntity?.entityType }}</span>
        </dd>
      </div>
    </dl>

    <div class="space-y-1.5">
      <p class="text-sm font-medium text-gray-700">Kind <span class="text-xs font-normal text-gray-400">(stored, not derived)</span></p>
      <select
        data-testid="relation-kind"
        v-model="kind"
        class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
      >
        <option v-for="k in kinds" :key="k" :value="k">{{ k }}</option>
      </select>
    </div>

    <div class="space-y-1.5">
      <p class="text-sm font-medium text-gray-700">Note</p>
      <textarea
        data-testid="relation-note"
        v-model="note"
        rows="3"
        placeholder="Optional note / field mapping…"
        class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
      />
    </div>

    <div class="flex items-center gap-2 border-t border-gray-200 pt-3">
      <Button data-testid="relation-save" :disabled="saving || !kind" @click="onSave">
        {{ saving ? 'Saving…' : 'Save' }}
      </Button>
      <Button v-if="!isDraft" data-testid="relation-remove" variant="ghost" @click="onRemove">
        Remove
      </Button>
      <Button v-if="isDraft" variant="ghost" data-testid="relation-cancel" @click="emit('close-draft')">
        Cancel
      </Button>
    </div>
  </div>
</template>
