<script setup>
// VIEW (canvas) — a dashed "+ …" snap-slot affordance inside a band cell.
// Plain flow child now (CSS auto-layout): empty variant = full card outline
// showing where the role snaps; append variant = compact row under a non-empty
// stack. Click → add (the place dialog opens scoped to this role).
defineProps({
  ghost: { type: Object, required: true }, // { role, variant, label }
})
const emit = defineEmits(['add'])
</script>

<template>
  <button
    :data-testid="`ghost-${ghost.role}`"
    class="flex w-44 items-center justify-center rounded-md border border-dashed border-gray-300 bg-white/40 text-xs text-gray-400 transition hover:border-brand hover:text-brand"
    :class="ghost.variant === 'empty' ? 'min-h-14' : 'min-h-7'"
    @click.stop="emit('add', ghost.role)"
  >
    {{ ghost.label }}
  </button>
</template>
