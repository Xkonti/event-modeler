<script setup>
// VIEW (inspector, W8) — the GWT/GT scenario editor. GWT anchors on a COMMAND
// (its accept/reject/emit spec); GT anchors on a READ MODEL or AUTOMATION and
// has NO When (the book's rule: When exists ⇔ a command is tested). Scenarios
// reference entities BY GUID and auto-surface in every slice showing them (F6)
// — the anchor stays unaware. Example values are free-form JSON per clause
// (v1: a textarea with a parse-on-save guard). outOfSync renders as a badge in
// edit mode (relations are the structural truth; scenarios are second-class
// commentary that can drift — gwt.md).
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  useScenario,
  useDefineScenario,
  useUpdateScenario,
  useArchiveScenario,
} from '@/repositories/scenarioRepository'
import { useSlice } from '@/repositories/sliceRepository'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUiStore } from '@/stores/ui'
import { reportMutationError } from '@/lib/errors'
import Button from '@/components/ui/Button.vue'

const props = defineProps({
  modelId: { type: String, required: true },
  // DRAFT mode: { sliceId, kind } — null in edit mode.
  draft: { type: Object, default: null },
  // EDIT mode: the selected scenario id.
  scenarioId: { type: String, default: null },
  catalog: { type: Array, default: () => [] },
})
const emit = defineEmits(['close-draft'])

const router = useRouter()
const ui = useUiStore()
const workspace = useWorkspaceStore()

const isDraft = computed(() => props.draft !== null)
const kind = computed(() =>
  isDraft.value ? props.draft.kind : scenario.value?.kind ?? 'GWT',
)

const scenarioQuery = useScenario(() => props.scenarioId ?? '', {
  enabled: () => !isDraft.value && !!props.scenarioId,
})
const scenario = computed(() => (isDraft.value ? null : scenarioQuery.data.value))

// Draft prefill: a GWT's anchor defaults to the slice's command (the slice DTO
// is cached — same key the canvas boards use per id).
const { data: draftSlice } = useSlice(() => props.draft?.sliceId ?? '', {
  enabled: () => !!props.draft?.sliceId,
})

const defineScenario = useDefineScenario()
const updateScenario = useUpdateScenario()
const archiveScenario = useArchiveScenario()

// --- pickers -------------------------------------------------------------------
const facts = computed(() =>
  props.catalog.filter(
    (e) => e.entityType === 'businessFact' || e.entityType === 'externalBusinessFact',
  ),
)
const anchorCandidates = computed(() =>
  kind.value === 'GWT'
    ? props.catalog.filter((e) => e.entityType === 'command')
    : props.catalog.filter(
        (e) => e.entityType === 'readModel' || e.entityType === 'automation',
      ),
)

// --- form state -----------------------------------------------------------------
const anchorId = ref('')
const given = ref([]) // [{factId, exists, valuesText}]
const whenText = ref('')
const thenKind = ref('emit') // emit | reject | error | state
const thenEmit = ref([]) // [{factId, valuesText}]
const thenErrorFactId = ref('')
const thenErrorText = ref('')
const thenRejectReason = ref('')
const thenStateText = ref('')
const formError = ref('')
const saving = ref(false)

watch(
  [scenario, draftSlice, () => props.draft],
  () => {
    if (isDraft.value) {
      // GWT: prefill the anchor with the slice's command if one is placed.
      if (kind.value === 'GWT' && !anchorId.value) {
        const cmd = (draftSlice.value?.placements ?? []).find(
          (p) => p.entityType === 'command',
        )
        if (cmd) anchorId.value = cmd.entityId
      }
      if (kind.value === 'GT') thenKind.value = 'state'
      return
    }
    const s = scenario.value
    if (!s) return
    anchorId.value = s.anchorId
    given.value = (s.given ?? []).map((g) => ({
      factId: g.factId,
      exists: g.exists !== false,
      valuesText: g.values ? JSON.stringify(g.values) : '',
    }))
    whenText.value = s.when?.values ? JSON.stringify(s.when.values) : ''
    const t = s.then ?? {}
    if (t.emit) {
      thenKind.value = 'emit'
      thenEmit.value = t.emit.map((e) => ({
        factId: e.factId,
        valuesText: e.values ? JSON.stringify(e.values) : '',
      }))
    } else if (t.reject) {
      thenKind.value = 'reject'
      thenRejectReason.value = t.reject.reason ?? ''
    } else if (t.error) {
      thenKind.value = 'error'
      thenErrorFactId.value = t.error.factId
      thenErrorText.value = t.error.values ? JSON.stringify(t.error.values) : ''
    } else if (t.state) {
      thenKind.value = 'state'
      thenStateText.value = JSON.stringify(t.state)
    }
  },
  { immediate: true },
)

function addGiven() {
  given.value = [...given.value, { factId: '', exists: true, valuesText: '' }]
}
function removeGiven(i) {
  given.value = given.value.filter((_, idx) => idx !== i)
}
function addEmit() {
  thenEmit.value = [...thenEmit.value, { factId: '', valuesText: '' }]
}
function removeEmit(i) {
  thenEmit.value = thenEmit.value.filter((_, idx) => idx !== i)
}

/** Parse a values textarea: '' → undefined; invalid JSON → throws with context. */
function parseValues(text, label) {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error(`${label}: values must be valid JSON (e.g. {"amount": 5})`)
  }
}

function buildBody() {
  if (!anchorId.value) throw new Error('Pick an anchor.')
  const givenSteps = given.value
    .filter((g) => g.factId)
    .map((g, i) => ({
      factId: g.factId,
      ...(g.exists ? {} : { exists: false }),
      ...(() => {
        const v = parseValues(g.valuesText, `GIVEN #${i + 1}`)
        return v !== undefined ? { values: v } : {}
      })(),
    }))
  const body = { anchorId: anchorId.value, given: givenSteps }
  if (kind.value === 'GWT') {
    const v = parseValues(whenText.value, 'WHEN')
    body.when = v !== undefined ? { values: v } : {}
  }
  switch (thenKind.value) {
    case 'emit': {
      const rows = thenEmit.value.filter((e) => e.factId)
      if (!rows.length) throw new Error('THEN emit needs at least one fact.')
      body.then = {
        emit: rows.map((e, i) => {
          const v = parseValues(e.valuesText, `THEN emit #${i + 1}`)
          return { factId: e.factId, ...(v !== undefined ? { values: v } : {}) }
        }),
      }
      break
    }
    case 'reject':
      body.then = {
        reject: thenRejectReason.value.trim() ? { reason: thenRejectReason.value.trim() } : {},
      }
      break
    case 'error': {
      if (!thenErrorFactId.value) throw new Error('THEN error needs a fact.')
      const v = parseValues(thenErrorText.value, 'THEN error')
      body.then = {
        error: { factId: thenErrorFactId.value, ...(v !== undefined ? { values: v } : {}) },
      }
      break
    }
    case 'state': {
      const v = parseValues(thenStateText.value, 'THEN state')
      body.then = { state: v ?? {} }
      break
    }
  }
  return body
}

async function onSave() {
  formError.value = ''
  let body
  try {
    body = buildBody()
  } catch (e) {
    formError.value = e.message
    return
  }
  saving.value = true
  try {
    if (isDraft.value) {
      const scenarioId = crypto.randomUUID()
      await defineScenario.mutateAsync({
        modelId: props.modelId,
        scenarioId,
        kind: kind.value,
        ...body,
      })
      emit('close-draft')
      workspace.select('scenario', scenarioId)
    } else {
      await updateScenario.mutateAsync({
        modelId: props.modelId,
        scenarioId: props.scenarioId,
        ...body,
      })
    }
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not save the scenario.')
  } finally {
    saving.value = false
  }
}

async function onArchive() {
  if (!window.confirm('Archive this scenario?')) return
  try {
    await archiveScenario.mutateAsync({
      modelId: props.modelId,
      scenarioId: props.scenarioId,
    })
    workspace.clearSelection()
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not archive the scenario.')
  }
}
</script>

<template>
  <div data-testid="scenario-editor" class="space-y-4 p-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-gray-900">
        {{ isDraft ? `New ${kind}` : `Scenario (${kind})` }}
      </h2>
      <span
        v-if="!isDraft && scenario?.outOfSync"
        data-testid="scenario-out-of-sync"
        class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700"
        title="References an archived/missing entity — the structural truth moved on."
      >
        out of sync
      </span>
    </div>

    <div class="space-y-1.5">
      <p class="text-sm font-medium text-gray-700">
        Anchor {{ kind === 'GWT' ? 'command' : 'read model / automation' }}
      </p>
      <select
        data-testid="scenario-anchor"
        v-model="anchorId"
        class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
      >
        <option value="" disabled>(pick)</option>
        <option v-for="e in anchorCandidates" :key="e._id" :value="e._id">{{ e.name }}</option>
      </select>
    </div>

    <!-- GIVEN -->
    <div class="space-y-1.5">
      <p class="text-sm font-medium text-gray-700">Given</p>
      <div v-for="(g, i) in given" :key="i" class="space-y-1 rounded border border-gray-200 p-2">
        <div class="flex items-center gap-1.5">
          <select
            :data-testid="`given-fact-${i}`"
            v-model="g.factId"
            class="w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
          >
            <option value="" disabled>(fact)</option>
            <option v-for="f in facts" :key="f._id" :value="f._id">{{ f.name }}</option>
          </select>
          <label class="flex items-center gap-1 text-xs text-gray-500">
            <input v-model="g.exists" type="checkbox" class="accent-brand" /> exists
          </label>
          <button class="rounded px-1 text-gray-400 hover:bg-gray-100" @click="removeGiven(i)">✕</button>
        </div>
        <input
          :data-testid="`given-values-${i}`"
          v-model="g.valuesText"
          placeholder='values JSON, e.g. {"year": 2026}'
          class="w-full rounded-md border border-gray-300 px-2 py-1 font-mono text-xs focus:border-brand focus:outline-none"
        />
      </div>
      <button
        data-testid="given-add"
        class="rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-brand hover:text-brand"
        @click="addGiven"
      >
        + Given fact
      </button>
    </div>

    <!-- WHEN (GWT only) -->
    <div v-if="kind === 'GWT'" class="space-y-1.5">
      <p class="text-sm font-medium text-gray-700">When <span class="text-xs font-normal text-gray-400">(the anchor command)</span></p>
      <input
        data-testid="when-values"
        v-model="whenText"
        placeholder='command values JSON, e.g. {"amount": 5}'
        class="w-full rounded-md border border-gray-300 px-2 py-1 font-mono text-xs focus:border-brand focus:outline-none"
      />
    </div>

    <!-- THEN -->
    <div class="space-y-1.5">
      <p class="text-sm font-medium text-gray-700">Then</p>
      <div class="flex gap-3 text-sm text-gray-600">
        <label v-for="opt in kind === 'GWT' ? ['emit', 'reject', 'error'] : ['state']" :key="opt" class="flex items-center gap-1">
          <input v-model="thenKind" type="radio" :value="opt" class="accent-brand" :data-testid="`then-kind-${opt}`" />
          {{ opt }}
        </label>
      </div>

      <template v-if="thenKind === 'emit'">
        <div v-for="(e, i) in thenEmit" :key="i" class="space-y-1 rounded border border-gray-200 p-2">
          <div class="flex items-center gap-1.5">
            <select
              :data-testid="`emit-fact-${i}`"
              v-model="e.factId"
              class="w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
            >
              <option value="" disabled>(fact)</option>
              <option v-for="f in facts" :key="f._id" :value="f._id">{{ f.name }}</option>
            </select>
            <button class="rounded px-1 text-gray-400 hover:bg-gray-100" @click="removeEmit(i)">✕</button>
          </div>
          <input
            :data-testid="`emit-values-${i}`"
            v-model="e.valuesText"
            placeholder='values JSON'
            class="w-full rounded-md border border-gray-300 px-2 py-1 font-mono text-xs focus:border-brand focus:outline-none"
          />
        </div>
        <button
          data-testid="emit-add"
          class="rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-brand hover:text-brand"
          @click="addEmit"
        >
          + Emitted fact
        </button>
      </template>

      <input
        v-else-if="thenKind === 'reject'"
        data-testid="reject-reason"
        v-model="thenRejectReason"
        placeholder="rejection reason (optional)"
        class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
      />

      <template v-else-if="thenKind === 'error'">
        <select
          data-testid="error-fact"
          v-model="thenErrorFactId"
          class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
        >
          <option value="" disabled>(error fact)</option>
          <option v-for="f in facts" :key="f._id" :value="f._id">{{ f.name }}</option>
        </select>
        <input
          data-testid="error-values"
          v-model="thenErrorText"
          placeholder="values JSON"
          class="w-full rounded-md border border-gray-300 px-2 py-1 font-mono text-xs focus:border-brand focus:outline-none"
        />
      </template>

      <input
        v-else
        data-testid="state-values"
        v-model="thenStateText"
        placeholder='read model state JSON, e.g. {"total": 12}'
        class="w-full rounded-md border border-gray-300 px-2 py-1 font-mono text-xs focus:border-brand focus:outline-none"
      />
    </div>

    <p v-if="formError" data-testid="scenario-error" class="text-sm text-red-600">{{ formError }}</p>

    <div class="flex items-center gap-2 border-t border-gray-200 pt-3">
      <Button data-testid="scenario-save" :disabled="saving" @click="onSave">
        {{ saving ? 'Saving…' : 'Save scenario' }}
      </Button>
      <Button v-if="!isDraft" data-testid="scenario-archive" variant="ghost" @click="onArchive">
        Archive
      </Button>
      <Button v-if="isDraft" variant="ghost" data-testid="scenario-cancel" @click="emit('close-draft')">
        Cancel
      </Button>
    </div>
  </div>
</template>
