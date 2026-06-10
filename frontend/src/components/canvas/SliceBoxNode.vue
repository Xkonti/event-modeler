<script setup>
// VIEW (canvas) — the slice BOX chrome, rendered as one non-draggable vue-flow
// parent node: header (name + rename/archive), the graph area (a spacer of
// solver-computed height that the entity CHILD nodes overlay), faint lane
// dividers + lane names in the reserved gutter, ghost snap-slots, and the
// bottom ScenarioStrip (CSS-auto height — boxes tile horizontally only, so
// strip height never affects siblings). All interactivity goes up through the
// canvasIntents injection.
import { computed, inject } from 'vue'
import GhostSlot from '@/components/canvas/GhostSlot.vue'
import ScenarioStrip from '@/components/canvas/ScenarioStrip.vue'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true }, // { sliceId, name, layout, strip }
})

const intents = inject('canvasIntents')
const contextNames = inject('contextNames') // Ref<Map<contextId, name>>

const layout = computed(() => props.data.layout)

// Lane label: resolve contextId → name (the solver only knows ids). The
// "(none)" pseudo-lane keeps its label; a dangling id renders shortened.
const visibleLanes = computed(() =>
  layout.value.lanes
    .filter((l) => l.label !== null) // lanes-off pseudo-lane draws nothing
    .map((l) => ({
      ...l,
      display:
        l.laneId === null
          ? '(none)'
          : contextNames?.value?.get(l.laneId) ?? l.laneId.slice(0, 8),
    })),
)

function onRename() {
  const name = window.prompt('Slice name', props.data.name)
  if (name && name.trim()) intents?.renameSlice(props.data.sliceId, name.trim())
}
function onArchive() {
  if (window.confirm(`Archive slice "${props.data.name || '(unnamed)'}"?`))
    intents?.archiveSlice(props.data.sliceId)
}
</script>

<template>
  <div
    :data-testid="`slice-box-${data.sliceId}`"
    class="rounded-lg border border-gray-300 bg-white shadow-sm"
  >
    <!-- header -->
    <div
      class="flex items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-50 px-3"
      :style="{ height: `${layout.header.height}px` }"
    >
      <!-- testid deliberately NOT slice-box-* — e2e selects boxes by that prefix. -->
      <span data-testid="slice-name" class="truncate text-sm font-semibold text-gray-800">
        {{ data.name || '(unnamed slice)' }}
      </span>
      <span class="nodrag flex items-center gap-1">
        <button
          :data-testid="`slice-rename-${data.sliceId}`"
          class="rounded px-1.5 text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-700"
          title="Rename slice"
          @click.stop="onRename"
        >
          ✎
        </button>
        <button
          :data-testid="`slice-archive-${data.sliceId}`"
          class="rounded px-1.5 text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-700"
          title="Archive slice"
          @click.stop="onArchive"
        >
          ⋯
        </button>
      </span>
    </div>

    <!-- graph area: spacer the entity child nodes overlay -->
    <div class="relative" :style="{ height: `${layout.graphHeight - layout.header.height}px` }">
      <!-- swimlane bands: faint dividers + names in the gutter (only when on) -->
      <template v-for="lane in visibleLanes" :key="lane.laneId ?? 'none'">
        <div
          class="pointer-events-none absolute left-0 right-0 border-t border-dashed border-gray-200"
          :style="{ top: `${lane.y - layout.header.height}px` }"
        />
        <span
          :data-testid="`lane-label-${lane.laneId ?? 'none'}`"
          class="pointer-events-none absolute truncate text-[10px] font-medium uppercase tracking-wide text-gray-400"
          :style="{
            left: '8px',
            top: `${lane.y - layout.header.height + 6}px`,
            maxWidth: '120px',
          }"
        >
          {{ lane.display }}
        </span>
      </template>

      <!-- ghost snap-slots -->
      <GhostSlot
        v-for="ghost in layout.ghosts"
        :key="ghost.id"
        :ghost="{ ...ghost, y: ghost.y - layout.header.height }"
        @add="(role) => intents?.addEntity(data.sliceId, role)"
      />
    </div>

    <!-- bottom text strip -->
    <ScenarioStrip
      :slice-id="data.sliceId"
      :strip="data.strip"
      @add-scenario="(kind) => intents?.addScenario(data.sliceId, kind)"
      @select-scenario="(id) => intents?.selectScenario(id, data.sliceId)"
    />
  </div>
</template>
