<script setup>
// VIEW (canvas host) — the slice editor. ONE query (useSlice) returns the whole
// board (placements + relations, archived entities pre-filtered server-side);
// this page maps that DTO → vue-flow nodes/edges, renders the canvas, and turns
// user gestures into slice-repo mutations. After each mutation the slice query
// is invalidated and refetched, so the SERVER stays the source of truth for
// positions/relations — we never optimistically mutate the board.
//
// Local-position preservation: a node mid-drag whose move mutation is still
// in-flight keeps its local position across a remap, so a refetch racing the
// drag doesn't snap the node back. Tracked by entityId in `inFlightMoves`.
//
// Edges are namespaced `rel:${_id}` so they can never collide with node ids
// (=entityId). New relations are NOT added optimistically — onConnect fires the
// draw mutation; the refetch renders the edge (or a banner surfaces on 422/409).
import { ref, watch, markRaw, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import EntityNode from '@/components/canvas/EntityNode.vue'
import RelationEdge from '@/components/canvas/RelationEdge.vue'
import CreateEntityDialog from '@/components/canvas/CreateEntityDialog.vue'
import { useUiStore } from '@/stores/ui'
import { useCanvasStore } from '@/stores/canvas'
import { HttpError } from '@/lib/http'
import {
  useSlice,
  usePlaceEntity,
  useMovePlacement,
  useRemovePlacement,
  useDrawRelation,
  useDeleteRelation,
} from '@/repositories/sliceRepository'

const route = useRoute()
const getId = () => route.params.id

const ui = useUiStore()
const canvas = useCanvasStore()

const { data: slice, isPending, error } = useSlice(getId)

// Custom node/edge component maps (markRaw — never make components reactive).
const nodeTypes = { entity: markRaw(EntityNode) }
const edgeTypes = { relation: markRaw(RelationEdge) }

// Local controlled graph state. vue-flow mutates these via v-model.
const nodes = ref([])
const edges = ref([])

// entityIds of nodes whose move mutation is currently in-flight. Their local
// position is preserved across a remap so a racing refetch can't snap them back.
const inFlightMoves = new Set()

// --- DTO → vue-flow mapping -------------------------------------------------
function mapToFlow(dto) {
  if (!dto) {
    nodes.value = []
    edges.value = []
    return
  }
  const placements = Array.isArray(dto.placements) ? dto.placements : []
  const relations = Array.isArray(dto.relations) ? dto.relations : []

  // Index current local positions so in-flight drags survive the remap.
  const localPos = new Map(nodes.value.map((n) => [n.id, n.position]))

  // Defensively drop ghosts: a placement with no name is an archived/stale entity.
  const mapped = placements
    .filter((p) => p && p.entityId && p.name)
    .map((p) => {
      const preserve = inFlightMoves.has(p.entityId) && localPos.has(p.entityId)
      return {
        id: p.entityId,
        type: 'entity',
        position: preserve ? localPos.get(p.entityId) : { x: p.x, y: p.y },
        data: { name: p.name, entityType: p.entityType },
      }
    })
  nodes.value = mapped

  // Drop dangling edges whose endpoints aren't in the node set.
  const nodeIds = new Set(mapped.map((n) => n.id))
  edges.value = relations
    .filter((r) => r && r._id && nodeIds.has(r.fromId) && nodeIds.has(r.toId))
    .map((r) => ({
      id: `rel:${r._id}`,
      type: 'relation',
      source: r.fromId,
      target: r.toId,
      data: { kind: r.kind, relationId: r._id },
      label: r.kind,
    }))
}

watch(slice, mapToFlow, { immediate: true })

// Slice load failure → banner (404 missing slice, network, etc.). Fires once per
// distinct error so a refetch loop doesn't spam banners.
watch(error, (err) => {
  if (!err) return
  if (err instanceof HttpError && err.status === 404) {
    ui.pushBanner('error', 'Slice not found.')
  } else {
    ui.pushBanner('error', err?.message || 'Could not load the slice.')
  }
})

// --- vue-flow event wiring --------------------------------------------------
const {
  onNodeDragStop,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  onViewportChangeEnd,
  screenToFlowCoordinate,
} = useVueFlow()

const placeEntity = usePlaceEntity()
const movePlacement = useMovePlacement()
const removePlacement = useRemovePlacement()
const drawRelation = useDrawRelation()
const deleteRelation = useDeleteRelation()

// Selection mirrors into the canvas store (so Delete-key handler can read it).
onNodeClick(({ node }) => canvas.selectNode(node.id))
onEdgeClick(({ edge }) => canvas.selectEdge(edge.id))
onPaneClick(() => canvas.clearSelection())
onViewportChangeEnd((vp) => canvas.setViewport(vp))

// Move: debounce per drag-stop so a flurry of small drags collapses to one PUT.
let moveTimer = null
onNodeDragStop(({ node }) => {
  inFlightMoves.add(node.id)
  if (moveTimer) clearTimeout(moveTimer)
  const { x, y } = node.position
  moveTimer = setTimeout(() => {
    movePlacement
      .mutateAsync({ sliceId: getId(), placedId: node.id, x, y })
      .catch((err) => banner(err, 'Could not move the entity.'))
      .finally(() => inFlightMoves.delete(node.id))
  }, 400)
})

// Connect: draw a relation. No optimistic edge — the refetch renders it. On
// 422 (invalid pair / missing endpoint) or 409 (already drawn) → banner.
onConnect(({ source, target }) => {
  if (!source || !target) return
  drawRelation
    .mutateAsync({
      sliceId: getId(),
      entityId: crypto.randomUUID(),
      fromId: source,
      toId: target,
    })
    .catch((err) => {
      if (err instanceof HttpError && err.status === 422) {
        ui.pushBanner('error', 'That relation is not allowed between these entities.')
      } else if (err instanceof HttpError && err.status === 409) {
        ui.pushBanner('error', 'That relation already exists.')
      } else {
        banner(err, 'Could not draw the relation.')
      }
    })
})

/** Generic error → banner helper (non-typed fallback). */
function banner(err, fallbackMsg) {
  const msg = err instanceof HttpError ? err.message || fallbackMsg : fallbackMsg
  ui.pushBanner('error', msg)
}

// --- keyboard: Delete removes the selected node placement / edge relation ----
function onKeydown(e) {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return
  // Ignore when typing in a field (dialog inputs etc.).
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return

  if (canvas.selectedNodeId) {
    const placedId = canvas.selectedNodeId
    canvas.clearSelection()
    removePlacement
      .mutateAsync({ sliceId: getId(), placedId })
      .catch((err) => banner(err, 'Could not remove the entity.'))
  } else if (canvas.selectedEdgeId) {
    // Edge id is `rel:${_id}`; recover the relation id from the selected edge.
    const edge = edges.value.find((ed) => ed.id === canvas.selectedEdgeId)
    const relationId = edge?.data?.relationId
    canvas.clearSelection()
    if (relationId) {
      deleteRelation
        .mutateAsync({ sliceId: getId(), relationId })
        .catch((err) => banner(err, 'Could not delete the relation.'))
    }
  }
}
window.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (moveTimer) clearTimeout(moveTimer)
})

// --- toolbar: create + place ------------------------------------------------
const dialogOpen = ref(false)
const dialogType = ref('businessFact') // 'businessFact' | 'command'

function openCreate(type) {
  dialogType.value = type
  dialogOpen.value = true
}

// Cascading fallback offset so successive creations don't stack exactly.
let placeOffset = 0

/**
 * Pick a flow-space position near the viewport center. Falls back to a cascading
 * offset if screenToFlowCoordinate isn't ready (e.g. canvas not yet measured).
 */
function nextPosition() {
  try {
    const el = document.querySelector('[data-testid="slice-canvas"]')
    if (el && screenToFlowCoordinate) {
      const rect = el.getBoundingClientRect()
      const p = screenToFlowCoordinate({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
      const offset = placeOffset
      placeOffset = (placeOffset + 32) % 256
      return { x: Math.round(p.x) + offset, y: Math.round(p.y) + offset }
    }
  } catch {
    // fall through to cascade
  }
  const offset = placeOffset
  placeOffset = (placeOffset + 32) % 256
  return { x: 80 + offset, y: 80 + offset }
}

// Define resolved in the dialog; now place on this slice. entityId is kept so a
// failed place can be retried with the same id (no orphan define).
async function onCreated({ entityId }) {
  const { x, y } = nextPosition()
  try {
    await placeEntity.mutateAsync({ sliceId: getId(), placedEntityId: entityId, x, y })
  } catch (err) {
    banner(err, 'Created the entity, but could not place it on the slice.')
  }
}
</script>

<template>
  <div data-testid="slice-canvas" class="relative h-full w-full">
    <!-- Toolbar overlay (top-left). -->
    <div class="absolute left-3 top-3 z-20 flex gap-2">
      <button
        data-testid="add-business-fact"
        class="rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-800 shadow-sm hover:bg-orange-100"
        @click="openCreate('businessFact')"
      >
        + Business fact
      </button>
      <button
        data-testid="add-command"
        class="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 shadow-sm hover:bg-blue-100"
        @click="openCreate('command')"
      >
        + Command
      </button>
    </div>

    <!-- Loading / empty overlays. -->
    <div
      v-if="isPending"
      data-testid="slice-loading"
      class="absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-500"
    >
      Loading slice…
    </div>
    <div
      v-else-if="!nodes.length"
      data-testid="slice-empty"
      class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-400"
    >
      No entities yet — add a business fact or command to start.
    </div>

    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :default-viewport="canvas.viewport"
      class="h-full w-full"
    >
      <Background />
    </VueFlow>

    <CreateEntityDialog
      v-model:open="dialogOpen"
      :entity-type="dialogType"
      @created="onCreated"
    />
  </div>
</template>
