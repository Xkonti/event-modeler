<script setup>
// VIEW (canvas) — a dashed "+ …" snap-slot affordance inside the box chrome
// (NOT a vue-flow node: not connectable, not draggable — making it a node buys
// nothing). Empty variant = full card outline showing where the role snaps;
// append variant = compact row under a non-empty stack. Click → add-entity
// intent (the place dialog opens scoped to this role).
defineProps({
  ghost: { type: Object, required: true }, // solver ghost rect
})
const emit = defineEmits(['add'])
</script>

<template>
  <button
    :data-testid="`ghost-${ghost.role}`"
    class="nodrag nopan absolute flex items-center justify-center rounded-md border border-dashed border-gray-300 bg-white/40 text-xs text-gray-400 transition hover:border-brand hover:text-brand"
    :style="{
      left: `${ghost.x}px`,
      top: `${ghost.y}px`,
      width: `${ghost.w}px`,
      height: `${ghost.h}px`,
    }"
    @click.stop="emit('add', ghost.role)"
  >
    {{ ghost.label }}
  </button>
</template>
