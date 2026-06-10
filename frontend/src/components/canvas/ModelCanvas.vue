<script setup>
// VIEW (canvas host) — the W3 canvas pane: ONE VueFlow instance tiling every
// slice box left→right in creation order. Fully CONTROLLED: geometry comes from
// the pure layout solver (lib/layout/sliceLayout) through the flow adapter —
// the user never authors x/y; entity nodes are children of their box node.
// Z-order sandwich: box chrome 0 < edges 5 < cards 10.
//
// Data: useSliceBoards (one combined query over the visible slice ids); any
// board mutation's ['slices'] prefix invalidation refetches it — the server
// stays the source of truth, no optimistic board mutation.
//
// Intents: placement-scoped mutations (slot SWAP, Delete-key placement removal)
// are issued HERE (they need board-local context); everything else — selection,
// add entity/scenario, draw relation, slice rename/archive — emits upward to
// Workspace.vue, the single cross-domain intent→repo hub. Node components can't
// bubble events (vue-flow renders them detached), so intents travel via
// provide('canvasIntents').
import { computed, provide, ref, watch, markRaw, onBeforeUnmount } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import SliceBoxNode from '@/components/canvas/SliceBoxNode.vue'
import EntityCardNode from '@/components/canvas/EntityCardNode.vue'
import RelationEdge from '@/components/canvas/RelationEdge.vue'
import { layoutSlice, layoutCanvas } from '@/lib/layout/sliceLayout'
import { mapSliceToFlow } from '@/lib/layout/flowAdapter'
import { useSliceBoards, useSwapSlots, useRemovePlacement } from '@/repositories/sliceRepository'
import { useCanvasStore } from '@/stores/canvas'
import { useUiStore } from '@/stores/ui'
import { HttpError } from '@/lib/http'

const props = defineProps({
  sliceIds: { type: Array, required: true }, // creation order (W3 tiling)
  lanesOn: { type: Boolean, default: false },
  contexts: { type: Array, default: () => [] }, // [{_id, name}] for lane labels
  selectedEntityId: { type: String, default: null },
  selectedRelationId: { type: String, default: null },
})

const emit = defineEmits([
  'select-entity',
  'select-relation',
  'select-scenario',
  'clear-selection',
  'add-entity', // { sliceId, role }
  'add-scenario', // { sliceId, kind }
  'add-slice',
  'draw-relation', // { fromId, toId }
  'rename-slice', // { sliceId, name }
  'archive-slice', // { sliceId }
])

const canvas = useCanvasStore()
const ui = useUiStore()

const { data: boards, isPending, error } = useSliceBoards(() => props.sliceIds)
const swapSlots = useSwapSlots()
const removePlacement = useRemovePlacement()

// --- DTO → controlled nodes/edges -------------------------------------------
const nodeTypes = { sliceBox: markRaw(SliceBoxNode), entityCard: markRaw(EntityCardNode) }
const edgeTypes = { relation: markRaw(RelationEdge) }
const nodes = ref([])
const edges = ref([])

function rebuild() {
  const dtos = boards.value ?? []
  const tiled = layoutCanvas(
    dtos.map((dto) => ({
      sliceId: dto._id,
      layout: layoutSlice(dto.placements ?? [], { lanesOn: props.lanesOn }),
    })),
  )
  const layoutById = new Map(tiled.map((t) => [t.sliceId, t]))
  const nextNodes = []
  const nextEdges = []
  for (const dto of dtos) {
    const t = layoutById.get(dto._id)
    const mapped = mapSliceToFlow(dto, t.layout, t.origin)
    nextNodes.push(...mapped.nodes)
    nextEdges.push(...mapped.edges)
  }
  nodes.value = nextNodes
  edges.value = nextEdges
}

watch([boards, () => props.lanesOn], rebuild, { immediate: true })

watch(error, (err) => {
  if (!err) return
  ui.pushBanner('error', err instanceof HttpError ? err.message || 'Could not load the board.' : 'Could not load the board.')
})

// --- intents (provide/inject — node components render detached) --------------
// Delete needs the BOX a selection came from (the same entity can sit in many
// boxes); remember the placement context of the last card click.
const lastPlacement = ref(null) // { sliceId, entityId } | null

// Visuals-only pending set (descendant of the spike's inFlightMoves trick):
// pulses both cards while their swap mutation is in flight, never positions.
const inFlightSwaps = ref(new Set())

function requestSwap(sliceId, entityIdA, entityIdB) {
  const next = new Set(inFlightSwaps.value)
  next.add(entityIdA).add(entityIdB)
  inFlightSwaps.value = next
  swapSlots
    .mutateAsync({ sliceId, entityIdA, entityIdB })
    .catch((err) => {
      ui.pushBanner('error', err instanceof HttpError ? err.message || 'Could not reorder.' : 'Could not reorder.')
    })
    .finally(() => {
      const done = new Set(inFlightSwaps.value)
      done.delete(entityIdA)
      done.delete(entityIdB)
      inFlightSwaps.value = done
    })
}

provide('canvasIntents', {
  selectEntity(entityId, sliceId) {
    lastPlacement.value = { sliceId, entityId }
    emit('select-entity', entityId)
  },
  selectRelation(relationId) {
    emit('select-relation', relationId)
  },
  selectScenario(scenarioId) {
    emit('select-scenario', scenarioId)
  },
  addEntity(sliceId, role) {
    emit('add-entity', { sliceId, role })
  },
  addScenario(sliceId, kind) {
    emit('add-scenario', { sliceId, kind })
  },
  renameSlice(sliceId, name) {
    emit('rename-slice', { sliceId, name })
  },
  archiveSlice(sliceId) {
    emit('archive-slice', { sliceId })
  },
  requestSwap,
})

provide('canvasState', {
  selectedEntityId: computed(() => props.selectedEntityId),
  inFlightSwaps,
})

provide(
  'contextNames',
  computed(() => new Map(props.contexts.map((c) => [c._id, c.name]))),
)

// --- vue-flow events ----------------------------------------------------------
const { onConnect, onPaneClick, onViewportChangeEnd } = useVueFlow()

onPaneClick(() => {
  lastPlacement.value = null
  emit('clear-selection')
})
onViewportChangeEnd((vp) => canvas.setViewport(vp))

// Connect gesture → relation intent. Node ids are box-scoped
// (`${sliceId}:${entityId}`); strip the scope, ignore box nodes.
const entityIdOf = (nodeId) => {
  if (!nodeId || nodeId.startsWith('box:')) return null
  const i = nodeId.indexOf(':')
  return i === -1 ? nodeId : nodeId.slice(i + 1)
}
onConnect(({ source, target }) => {
  const fromId = entityIdOf(source)
  const toId = entityIdOf(target)
  if (!fromId || !toId || fromId === toId) return
  emit('draw-relation', { fromId, toId })
})

// --- Delete key: remove the selected card's PLACEMENT (not the entity) -------
function onKeydown(e) {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
  const lp = lastPlacement.value
  if (!lp || props.selectedEntityId !== lp.entityId) return
  lastPlacement.value = null
  emit('clear-selection')
  removePlacement
    .mutateAsync({ sliceId: lp.sliceId, placedId: lp.entityId })
    .catch((err) => {
      ui.pushBanner('error', err instanceof HttpError ? err.message || 'Could not remove the entity.' : 'Could not remove the entity.')
    })
}
window.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div data-testid="model-canvas" class="relative h-full w-full">
    <!-- + add slice (always available, top-left overlay) -->
    <div class="absolute left-3 top-3 z-20">
      <button
        data-testid="add-slice"
        class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        @click="emit('add-slice')"
      >
        + Add slice
      </button>
    </div>

    <div
      v-if="isPending && sliceIds.length"
      data-testid="canvas-loading"
      class="absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-500"
    >
      Loading board…
    </div>
    <div
      v-else-if="!sliceIds.length"
      data-testid="canvas-empty"
      class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-400"
    >
      No slices yet — add one to start modeling.
    </div>

    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :default-viewport="canvas.viewport"
      :min-zoom="0.2"
      class="h-full w-full"
    >
      <Background />
    </VueFlow>
  </div>
</template>
