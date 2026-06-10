<script setup>
// VIEW — W3 left palette: "+ <Type>" buttons for all 7 entity types (each opens
// the inspector on a FRESH entity — create == edit-on-fresh, nothing persists
// until first save) + the model's catalog grouped by type with client-side
// search. Click a row → select (inspector shows it).
import { computed, ref } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { ENTITY_REPOS } from '@/repositories/entityRepos'

const props = defineProps({
  catalog: { type: Array, default: () => [] }, // [{_id, entityType, name}]
})

const workspace = useWorkspaceStore()
const search = ref('')

const TYPES = Object.keys(ENTITY_REPOS) // palette order = registry order

const grouped = computed(() => {
  const q = search.value.trim().toLowerCase()
  const rows = q
    ? props.catalog.filter((e) => e.name.toLowerCase().includes(q))
    : props.catalog
  return TYPES.map((type) => ({
    type,
    label: ENTITY_REPOS[type].label,
    entries: rows.filter((e) => e.entityType === type),
  })).filter((g) => g.entries.length > 0)
})

function startCreate(entityType) {
  workspace.startDraft({ entityType, entityId: crypto.randomUUID() })
}
</script>

<template>
  <aside class="flex h-full flex-col gap-3 overflow-y-auto border-r border-gray-200 bg-white p-3">
    <div class="space-y-1">
      <button
        v-for="type in TYPES"
        :key="type"
        :data-testid="`palette-add-${type}`"
        class="block w-full rounded-md border border-dashed border-gray-300 px-2 py-1 text-left text-sm text-gray-600 hover:border-brand hover:text-brand"
        @click="startCreate(type)"
      >
        + {{ ENTITY_REPOS[type].label }}
      </button>
    </div>

    <div class="border-t border-gray-200 pt-3">
      <input
        data-testid="palette-search"
        v-model="search"
        type="search"
        placeholder="Search catalog…"
        class="mb-2 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
      />
      <p v-if="!catalog.length" class="text-xs text-gray-400">Catalog is empty.</p>
      <div v-for="group in grouped" :key="group.type" class="mb-2">
        <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          {{ group.label }}
        </p>
        <button
          v-for="entry in group.entries"
          :key="entry._id"
          :data-testid="`palette-entity-${entry._id}`"
          class="block w-full truncate rounded px-2 py-0.5 text-left text-sm text-gray-700 hover:bg-gray-100"
          :class="workspace.selectedEntityId === entry._id ? 'bg-gray-100 font-medium' : ''"
          :title="entry.name"
          @click="workspace.select('entity', entry._id)"
        >
          {{ entry.name }}
        </button>
      </div>
    </div>
  </aside>
</template>
