<script setup>
// VIEW — the "+ <role>" ghost-slot dialog (W4 action): pick an EXISTING catalog
// entity whose type snaps into the clicked role band (and isn't already placed
// in this slice), or jump to "create new" (inspector draft with
// placeIntoSliceId so the entity is placed right after its first save).
// Single-cardinality types vanish from the list once the slice holds one.
import { computed } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import { slotRoleFor, isSingleCardinality } from '@/lib/slotRoles'
import { ENTITY_REPOS } from '@/repositories/entityRepos'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSlice } from '@/repositories/sliceRepository'

const props = defineProps({
  open: { type: Boolean, default: false },
  role: { type: String, default: null }, // trigger | command | readModel | fact
  sliceId: { type: String, default: null },
  catalog: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:open', 'place'])

const workspace = useWorkspaceStore()

// The slice's current placements — filters out already-placed entities and
// single-cardinality types whose slot is taken. Cached board read.
const { data: slice } = useSlice(() => props.sliceId ?? '', {
  enabled: () => !!props.sliceId,
})

const placedIds = computed(
  () => new Set((slice.value?.placements ?? []).map((p) => p.entityId)),
)
const placedTypes = computed(
  () => new Set((slice.value?.placements ?? []).map((p) => p.entityType)),
)

const candidates = computed(() =>
  props.catalog.filter((e) => {
    if (slotRoleFor(e.entityType) !== props.role) return false
    if (placedIds.value.has(e._id)) return false
    if (isSingleCardinality(e.entityType) && placedTypes.value.has(e.entityType)) return false
    return true
  }),
)

// Types creatable for this role (the "create new" shortcuts).
const creatableTypes = computed(() =>
  Object.keys(ENTITY_REPOS).filter((t) => {
    if (slotRoleFor(t) !== props.role) return false
    if (isSingleCardinality(t) && placedTypes.value.has(t)) return false
    return true
  }),
)

function pick(entityId) {
  emit('place', { sliceId: props.sliceId, placedEntityId: entityId })
  emit('update:open', false)
}

function createNew(entityType) {
  workspace.startDraft({
    entityType,
    entityId: crypto.randomUUID(),
    placeIntoSliceId: props.sliceId,
  })
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" :title="`Add to the ${role} slot`" @update:open="(v) => emit('update:open', v)">
    <div class="space-y-3">
      <div v-if="candidates.length" class="max-h-60 space-y-1 overflow-y-auto">
        <button
          v-for="entry in candidates"
          :key="entry._id"
          :data-testid="`place-pick-${entry._id}`"
          class="block w-full truncate rounded border border-gray-200 px-2 py-1.5 text-left text-sm text-gray-800 hover:border-brand hover:bg-gray-50"
          :title="entry.name"
          @click="pick(entry._id)"
        >
          {{ entry.name }}
          <span class="ml-1 text-xs text-gray-400">{{ ENTITY_REPOS[entry.entityType]?.label }}</span>
        </button>
      </div>
      <p v-else class="text-sm text-gray-500">Nothing in the catalog fits this slot yet.</p>

      <div class="flex flex-wrap gap-2 border-t border-gray-200 pt-3">
        <Button
          v-for="type in creatableTypes"
          :key="type"
          :data-testid="`place-create-${type}`"
          variant="secondary"
          @click="createNew(type)"
        >
          New {{ ENTITY_REPOS[type].label.toLowerCase() }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>
