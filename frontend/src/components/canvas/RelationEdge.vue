<script setup>
// VIEW (canvas) — custom vue-flow edge for a relation. Smoothstep path (the
// staircase layout reads as clean orthogonal elbows) + the relation KIND as an
// HTML label via EdgeLabelRenderer. Direction is baked into the handles by the
// flow adapter (down-edges bottom→top, up-edges/back-edges top→bottom — D1).
// Testid carries slice + kind so e2e can assert an edge exists per box without
// SVG internals. Purely presentational.
import { computed, inject } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@vue-flow/core'

const props = defineProps({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  sourceX: { type: Number, required: true },
  sourceY: { type: Number, required: true },
  targetX: { type: Number, required: true },
  targetY: { type: Number, required: true },
  sourcePosition: { type: String, default: undefined },
  targetPosition: { type: String, default: undefined },
  selected: { type: Boolean, default: false },
  markerEnd: { type: String, default: '' },
  data: { type: Object, default: () => ({}) },
  label: { type: String, default: '' },
})

const intents = inject('canvasIntents')

// getSmoothStepPath returns [pathD, labelX, labelY, ...].
const path = computed(() =>
  getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    borderRadius: 8,
  }),
)
const labelText = computed(() => props.label || props.data?.kind || '')
const isSelected = computed(() => props.selected || false)

function onClick() {
  intents?.selectRelation(props.data?.relationId, props.data?.sliceId)
}
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path[0]"
    :marker-end="markerEnd"
    :class="isSelected ? 'stroke-brand' : ''"
  />
  <EdgeLabelRenderer>
    <button
      :data-testid="`edge-${data.sliceId}-${data.kind}`"
      class="nodrag nopan pointer-events-auto absolute rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm hover:ring-1 hover:ring-brand"
      :style="{
        transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)`,
      }"
      @click.stop="onClick"
    >
      {{ labelText }}
    </button>
  </EdgeLabelRenderer>
</template>
