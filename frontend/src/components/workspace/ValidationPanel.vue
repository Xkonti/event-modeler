<script setup>
// VIEW (W3) — the validation PUNCH-LIST panel (decided surfacing for A2). Docks
// over the inspector while open. Findings come from the on-demand
// GET /models/:id/validation — ADVISORY only, never gates a command (G-C10).
// Clicking a finding selects the entity (canvas highlights it; the inspector
// shows it after closing the panel) and best-effort scrolls its card into view.
import { useWorkspaceStore } from '@/stores/workspace'
import Button from '@/components/ui/Button.vue'

defineProps({
  modelId: { type: String, required: true },
  findings: { type: Array, default: () => [] },
  pending: { type: Boolean, default: false },
})
const emit = defineEmits(['recheck', 'close'])

const workspace = useWorkspaceStore()

const KIND_LABELS = {
  'fact-without-producer': 'Fact has no producing command',
  'command-without-trigger': 'Command has no trigger',
  'readmodel-without-source': 'Read model has no feeding fact',
  'field-without-source': 'Field has no upstream source',
  'scenario-out-of-sync': 'Scenario out of sync',
}

function focus(finding) {
  if (finding.kind === 'scenario-out-of-sync') {
    workspace.select('scenario', finding.entityId)
  } else {
    workspace.select('entity', finding.entityId)
  }
  // Best-effort: bring the card into view (cards stamp data-entity-id).
  document
    .querySelector(`[data-entity-id="${finding.entityId}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
</script>

<template>
  <div data-testid="validation-panel" class="space-y-3 p-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-gray-900">Model check</h2>
      <div class="flex items-center gap-1">
        <Button variant="ghost" data-testid="validation-recheck" :disabled="pending" @click="emit('recheck')">
          ↻
        </Button>
        <Button variant="ghost" data-testid="validation-close" @click="emit('close')">✕</Button>
      </div>
    </div>

    <p v-if="pending" class="text-sm text-gray-500">Checking…</p>
    <p
      v-else-if="!findings.length"
      data-testid="validation-clean"
      class="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800"
    >
      No findings — every checked element traces to a source.
    </p>

    <ul v-else class="space-y-1.5">
      <li v-for="(finding, i) in findings" :key="`${finding.entityId}-${finding.kind}-${i}`">
        <button
          :data-testid="`validation-finding-${finding.entityId}`"
          class="w-full rounded-md border border-amber-200 bg-amber-50 p-2 text-left hover:border-amber-400"
          @click="focus(finding)"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-amber-700">
            {{ KIND_LABELS[finding.kind] ?? finding.kind }}
          </p>
          <p class="truncate text-sm text-gray-800">{{ finding.entityName }}</p>
          <p v-if="finding.missingSource" class="truncate text-xs text-gray-500">
            missing: {{ finding.missingSource }}
          </p>
        </button>
      </li>
    </ul>

    <p class="text-xs text-gray-400">
      Advisory only — findings never block editing.
    </p>
  </div>
</template>
