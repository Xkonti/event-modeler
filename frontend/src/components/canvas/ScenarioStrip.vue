<script setup>
// VIEW (canvas) — the slice box's bottom TEXT strip: auto-surfaced GWT/GT
// scenarios (F6 — pulled in by reference, never placed) rendered as text,
// grouped by anchor, exactly the W4 art. Clamped with an expander; `nodrag
// nopan` so text selection doesn't fight the canvas. "+ GWT / + GT" open the
// scenario editor via intent. A notes slot is reserved for later (the DTO
// carries no notes yet).
import { computed, ref } from 'vue'

const props = defineProps({
  sliceId: { type: String, required: true },
  strip: { type: Array, default: () => [] }, // buildStripModel output
})
const emit = defineEmits(['add-scenario', 'select-scenario'])

const CLAMP = 4
const expanded = ref(false)
const total = computed(() => props.strip.reduce((n, g) => n + g.scenarios.length, 0))

/** Flat clamped rows: [{ group, scenario }] */
const rows = computed(() => {
  const flat = props.strip.flatMap((g) => g.scenarios.map((s) => ({ group: g, scenario: s })))
  return expanded.value ? flat : flat.slice(0, CLAMP)
})

function clauseText(s) {
  const given = (s.given ?? [])
    .map((g) => `${g.exists === false ? 'NOT ' : ''}${g.factId}${g.values ? ' ' + JSON.stringify(g.values) : ''}`)
    .join(', ')
  const parts = [`GIVEN ${given || '—'}`]
  if (s.when) parts.push(`WHEN ${JSON.stringify(s.when.values ?? {})}`)
  const t = s.then ?? {}
  if (t.emit) parts.push(`THEN emit ${t.emit.map((e) => e.factId).join(', ')}`)
  else if (t.reject) parts.push('THEN reject')
  else if (t.error) parts.push(`THEN error ${t.error.factId}`)
  else if (t.state) parts.push(`THEN state ${JSON.stringify(t.state)}`)
  return parts.join(' · ')
}
</script>

<template>
  <div
    :data-testid="`scenario-strip-${sliceId}`"
    class="nodrag nopan border-t border-gray-200 bg-gray-50/80 px-3 py-2 text-[11px] leading-5 text-gray-700"
  >
    <div v-for="row in rows" :key="row.scenario._id">
      <button
        :data-testid="`scenario-${row.scenario._id}`"
        class="block w-full truncate rounded px-1 text-left hover:bg-gray-100"
        :title="clauseText(row.scenario)"
        @click.stop="emit('select-scenario', row.scenario._id)"
      >
        <span class="font-semibold">{{ row.scenario.kind }}</span>
        <span class="text-gray-500"> ({{ row.group.anchorName }}):</span>
        {{ clauseText(row.scenario) }}
      </button>
    </div>

    <div class="mt-1 flex items-center gap-2">
      <button
        v-if="total > CLAMP"
        class="rounded px-1 text-gray-500 hover:bg-gray-100"
        @click.stop="expanded = !expanded"
      >
        {{ expanded ? 'show less' : `show all (${total})` }}
      </button>
      <button
        :data-testid="`add-gwt-${sliceId}`"
        class="rounded border border-dashed border-gray-300 px-1.5 text-gray-400 hover:border-brand hover:text-brand"
        @click.stop="emit('add-scenario', 'GWT')"
      >
        + GWT
      </button>
      <button
        :data-testid="`add-gt-${sliceId}`"
        class="rounded border border-dashed border-gray-300 px-1.5 text-gray-400 hover:border-brand hover:text-brand"
        @click.stop="emit('add-scenario', 'GT')"
      >
        + GT
      </button>
    </div>
  </div>
</template>
