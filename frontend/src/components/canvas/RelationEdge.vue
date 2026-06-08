<script setup>
// VIEW (canvas) — custom vue-flow edge for a relation. Draws a bezier path via
// vue-flow's BaseEdge and renders the relation kind as an HTML label through
// EdgeLabelRenderer. The label carries a stable, getByTestId-addressable testid
// (`edge-${source}-${target}`) so e2e can assert an edge exists without relying
// on SVG internals. Purely presentational: relation data comes from the slice
// DTO via SliceCanvas.
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@vue-flow/core'

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

// getBezierPath returns [pathD, labelX, labelY, ...]; destructure what we need.
const path = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  }),
)
const labelText = computed(() => props.label || props.data?.kind || '')
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path[0]"
    :marker-end="markerEnd"
    :class="selected ? 'stroke-brand' : ''"
  />
  <EdgeLabelRenderer>
    <div
      :data-testid="`edge-${source}-${target}`"
      class="nodrag nopan pointer-events-auto absolute rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm"
      :style="{
        transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)`,
      }"
    >
      {{ labelText }}
    </div>
  </EdgeLabelRenderer>
</template>
