<script setup>
// VIEW (canvas) — an entity card snapped into its band slot. Position comes
// from the layout solver via the flow adapter (controlled — never dragged
// freely). Colored per the event-modeling convention, 7 types incl. YELLOW
// external facts. Exposes 4 handles (stable ids for e2e + direction-aware edge
// routing: down-edges leave bottom-left, up-edges leave top-right) and the
// ▲▼ swap buttons (the e2e-stable reorder path; drag-onto-target layers on).
// Intents go up via the canvasIntents injection (vue-flow renders nodes outside
// the ModelCanvas template, so events can't bubble).
import { computed, inject } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, default: () => ({}) },
})

const intents = inject('canvasIntents')
const canvasState = inject('canvasState') // { selectedEntityId, inFlightSwaps }

// Per event-modeling color convention (em book): facts orange, EXTERNAL facts
// yellow, commands blue, read models green, wireframes white, automations
// purple, translations teal.
const palette = {
  businessFact: { chip: 'bg-orange-100 text-orange-800', body: 'border-orange-300 bg-orange-50', label: 'Fact' },
  externalBusinessFact: { chip: 'bg-yellow-100 text-yellow-800', body: 'border-yellow-400 bg-yellow-50', label: 'External' },
  command: { chip: 'bg-blue-100 text-blue-800', body: 'border-blue-300 bg-blue-50', label: 'Command' },
  readModel: { chip: 'bg-green-100 text-green-800', body: 'border-green-300 bg-green-50', label: 'Read model' },
  wireframe: { chip: 'bg-gray-100 text-gray-700', body: 'border-gray-300 bg-white', label: 'Wireframe' },
  automation: { chip: 'bg-purple-100 text-purple-800', body: 'border-purple-300 bg-purple-50', label: 'Automation' },
  translation: { chip: 'bg-teal-100 text-teal-800', body: 'border-teal-300 bg-teal-50', label: 'Translation' },
}
const fallback = { chip: 'bg-gray-100 text-gray-700', body: 'border-gray-300 bg-white', label: 'Entity' }

const skin = computed(() => palette[props.data?.entityType] ?? fallback)
const selected = computed(() => canvasState?.selectedEntityId?.value === props.data?.entityId)
const pending = computed(() => canvasState?.inFlightSwaps?.value?.has(props.data?.entityId) ?? false)

function onClick() {
  intents?.selectEntity(props.data.entityId, props.data.sliceId)
}
function swap(otherId) {
  if (!otherId) return
  intents?.requestSwap(props.data.sliceId, props.data.entityId, otherId)
}
</script>

<template>
  <div
    :data-testid="`node-${data.entityId}`"
    :data-entity-id="data.entityId"
    class="group relative h-14 w-44 rounded-md border px-3 py-2 shadow-sm transition"
    :class="[skin.body, selected ? 'ring-2 ring-brand ring-offset-1' : '', pending ? 'animate-pulse opacity-70' : '']"
    @click.stop="onClick"
  >
    <!-- Direction-aware handles: down-edges bottom-left pair, up-edges top-right pair. -->
    <Handle id="tt" type="target" :position="Position.Top" :style="{ left: '35%' }" :data-testid="`handle-tt-${data.entityId}`" />
    <Handle id="ts" type="source" :position="Position.Top" :style="{ left: '65%' }" :data-testid="`handle-ts-${data.entityId}`" />
    <Handle id="bs" type="source" :position="Position.Bottom" :style="{ left: '35%' }" :data-testid="`handle-bs-${data.entityId}`" />
    <Handle id="bt" type="target" :position="Position.Bottom" :style="{ left: '65%' }" :data-testid="`handle-bt-${data.entityId}`" />

    <div class="flex items-center justify-between gap-2">
      <span data-testid="node-name" class="truncate text-sm font-medium text-gray-900" :title="data?.name">
        {{ data?.name }}
      </span>
      <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" :class="skin.chip">
        {{ skin.label }}
      </span>
    </div>

    <!-- ▲▼ swap-with-neighbour (only when a same-band/lane sibling exists). -->
    <div
      v-if="data.swapUpId || data.swapDownId"
      class="absolute -right-2 top-1/2 z-10 flex -translate-y-1/2 translate-x-full flex-col gap-0.5 opacity-0 transition group-hover:opacity-100"
    >
      <button
        v-if="data.swapUpId"
        :data-testid="`swap-up-${data.entityId}`"
        class="rounded border border-gray-300 bg-white px-1 text-[10px] leading-4 text-gray-600 shadow-sm hover:bg-gray-50"
        title="Swap with the card above"
        @click.stop="swap(data.swapUpId)"
      >
        ▲
      </button>
      <button
        v-if="data.swapDownId"
        :data-testid="`swap-down-${data.entityId}`"
        class="rounded border border-gray-300 bg-white px-1 text-[10px] leading-4 text-gray-600 shadow-sm hover:bg-gray-50"
        title="Swap with the card below"
        @click.stop="swap(data.swapDownId)"
      >
        ▼
      </button>
    </div>
  </div>
</template>
