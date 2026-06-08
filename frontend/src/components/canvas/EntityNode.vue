<script setup>
// VIEW (canvas) — custom vue-flow node: an event-modeling sticky note. Renders
// an entity's name + a type chip, colored by entity type per the event-modeling
// convention (businessFact → orange family, command → blue family). Selection is
// signalled with the brand ring. Purely presentational: positions/data come from
// the slice DTO via SliceCanvas; this node never touches the cache or transport.
//
// vue-flow passes node props (id, data, selected, ...) into the registered
// component. We expose Left target + Right source handles so edges connect
// command → fact left-to-right; handle testids are stable for e2e drag.
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, default: () => ({}) },
  selected: { type: Boolean, default: false },
})

// Per event-modeling color convention. Unknown types fall back to neutral gray.
const palette = {
  businessFact: {
    chip: 'bg-orange-100 text-orange-800',
    body: 'border-orange-300 bg-orange-50',
    label: 'Fact',
  },
  command: {
    chip: 'bg-blue-100 text-blue-800',
    body: 'border-blue-300 bg-blue-50',
    label: 'Command',
  },
}
const fallback = { chip: 'bg-gray-100 text-gray-700', body: 'border-gray-300 bg-white', label: 'Entity' }

const skin = computed(() => palette[props.data?.entityType] ?? fallback)
</script>

<template>
  <div
    :data-testid="`node-${id}`"
    class="min-w-40 max-w-56 rounded-md border px-3 py-2 shadow-sm transition"
    :class="[skin.body, selected ? 'ring-2 ring-brand ring-offset-1' : '']"
  >
    <Handle
      :id="`handle-target-${id}`"
      type="target"
      :position="Position.Left"
      :data-testid="`handle-target-${id}`"
    />
    <div class="flex items-center justify-between gap-2">
      <span
        data-testid="node-name"
        class="truncate text-sm font-medium text-gray-900"
        :title="data?.name"
      >
        {{ data?.name }}
      </span>
      <span
        class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        :class="skin.chip"
      >
        {{ skin.label }}
      </span>
    </div>
    <Handle
      :id="`handle-source-${id}`"
      type="source"
      :position="Position.Right"
      :data-testid="`handle-source-${id}`"
    />
  </div>
</template>
