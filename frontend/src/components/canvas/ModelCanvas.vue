<script setup>
// VIEW (canvas host) — the W3 canvas pane as a plain scrollable CSS GRID, the
// "giant table" (notes/layout-and-rendering.md → "Rendering mechanism"; no
// graph lib, no layout solver). Columns = slices left→right in creation order;
// rows = [header] [trigger] [command] [fact lane × N] [strip], SHARED across
// the board — every SliceFrame is a subgrid column, so lanes align across
// slices and each row auto-sizes to its tallest cell. Pan = native scroll.
//
// Relations render as straight SVG lines in one absolutely-positioned overlay:
// endpoints are measured from the card DOM rects (data-card markers) after
// every board/toggle change and on container resize. Creating a relation is a
// card button (EntityCard ← / →), not a gesture.
//
// Data: useSliceBoards (one combined query over the visible slice ids); any
// board mutation's ['slices'] prefix invalidation refetches it — the server
// stays the source of truth. Placement-scoped mutations (slot SWAP, Delete-key
// placement removal) are issued HERE; everything else emits upward to
// Workspace.vue, the single cross-domain intent→repo hub.
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import SliceFrame from '@/components/canvas/SliceFrame.vue'
import { laneRowsFor, autoReadModels } from '@/lib/layout/boardView'
import { useSliceBoards, useSwapSlots, useRemovePlacement } from '@/repositories/sliceRepository'
import { useModelRelations } from '@/repositories/relationRepository'
import { useCatalog } from '@/repositories/catalogRepository'
import { useUiStore } from '@/stores/ui'
import { HttpError } from '@/lib/http'

const props = defineProps({
  modelId: { type: String, required: true },
  sliceIds: { type: Array, required: true }, // creation order (W3 tiling)
  lanesOn: { type: Boolean, default: false },
  fieldsOn: { type: Boolean, default: true },
  contexts: { type: Array, default: () => [] }, // [{_id, name}] for lane labels
  chapters: { type: Array, default: () => [] }, // [{_id, name}] C1 band, creation order
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
  'assign-chapter', // { sliceId, chapterId | null }
  'create-chapter', // { sliceId, name }
])

const ui = useUiStore()

const { data: boards, isPending, error } = useSliceBoards(() => props.sliceIds)
const swapSlots = useSwapSlots()
const removePlacement = useRemovePlacement()

const boardList = computed(() => boards.value ?? [])
const laneRows = computed(() => laneRowsFor(boardList.value, props.lanesOn))

// Auto-displayed read models — derived from the model-level relation graph +
// catalog (RMs are never placed). Cache-shared with Workspace's useCatalog.
const { data: modelRelations } = useModelRelations(() => props.modelId)
const { data: catalog } = useCatalog(() => props.modelId)
const autoRmBySlice = computed(() =>
  autoReadModels(boardList.value, modelRelations.value ?? [], catalog.value ?? []),
)
const EMPTY_AUTO_RM = { cards: [], edges: [] }

// Shared row template: [chapter band] [header] [trigger] [command] [lane × N] [strip].
const gridRows = computed(
  () => `auto auto auto auto ${laneRows.value.map(() => 'auto').join(' ')} auto`,
)

const contextNames = computed(() => new Map(props.contexts.map((c) => [c._id, c.name])))
const laneLabel = (laneId) =>
  laneId === null ? '(none)' : contextNames.value.get(laneId) ?? laneId.slice(0, 8)

watch(error, (err) => {
  if (!err) return
  ui.pushBanner('error', err instanceof HttpError ? err.message || 'Could not load the board.' : 'Could not load the board.')
})

// --- relation overlay ---------------------------------------------------------
// Edge list from the DTOs (both endpoints placed in the slice — the server
// already filters; drop defensively anyway), then MEASURED into line segments
// from the rendered card rects. Straight lines by design.
const gridEl = ref(null) // the grid (also the overlay's coordinate space)
const edgeSegments = ref([])

function measureEdges() {
  const host = gridEl.value
  if (!host) {
    edgeSegments.value = []
    return
  }
  const hostRect = host.getBoundingClientRect()
  const segments = []
  for (const board of boardList.value) {
    const placed = new Set((board.placements ?? []).map((p) => p.entityId))
    for (const rel of board.relations ?? []) {
      if (!placed.has(rel.fromId) || !placed.has(rel.toId)) continue
      const fromEl = host.querySelector(`[data-card="${board._id}:${rel.fromId}"]`)
      const toEl = host.querySelector(`[data-card="${board._id}:${rel.toId}"]`)
      if (!fromEl || !toEl) continue
      const a = fromEl.getBoundingClientRect()
      const b = toEl.getBoundingClientRect()
      // Leave from the edge facing the target: bottom-center when the target
      // sits below, top-center when above.
      const down = b.top + b.height / 2 >= a.top + a.height / 2
      segments.push({
        id: `${rel._id}@${board._id}`,
        relationId: rel._id,
        sliceId: board._id,
        kind: rel.kind,
        x1: a.left + a.width / 2 - hostRect.left,
        y1: (down ? a.bottom : a.top) - hostRect.top,
        x2: b.left + b.width / 2 - hostRect.left,
        y2: (down ? b.top : b.bottom) - hostRect.top,
      })
    }
  }
  // Auto-read-model edges (display + feeds, possibly cross-slice) come as
  // explicit descriptors — both endpoints resolved to a concrete slice's card.
  // Mostly-horizontal pairs anchor on left/right edges instead of top/bottom.
  for (const [, vm] of autoRmBySlice.value) {
    for (const e of vm.edges) {
      const fromEl = host.querySelector(`[data-card="${e.from.sliceId}:${e.from.entityId}"]`)
      const toEl = host.querySelector(`[data-card="${e.to.sliceId}:${e.to.entityId}"]`)
      if (!fromEl || !toEl) continue
      const a = fromEl.getBoundingClientRect()
      const b = toEl.getBoundingClientRect()
      const dx = b.left + b.width / 2 - (a.left + a.width / 2)
      const dy = b.top + b.height / 2 - (a.top + a.height / 2)
      const horizontal = Math.abs(dx) > Math.abs(dy)
      const seg = horizontal
        ? {
            x1: (dx >= 0 ? a.right : a.left) - hostRect.left,
            y1: a.top + a.height / 2 - hostRect.top,
            x2: (dx >= 0 ? b.left : b.right) - hostRect.left,
            y2: b.top + b.height / 2 - hostRect.top,
          }
        : {
            x1: a.left + a.width / 2 - hostRect.left,
            y1: (dy >= 0 ? a.bottom : a.top) - hostRect.top,
            x2: b.left + b.width / 2 - hostRect.left,
            y2: (dy >= 0 ? b.top : b.bottom) - hostRect.top,
          }
      segments.push({
        id: `${e.relationId}@${e.from.sliceId}->${e.to.sliceId}`,
        relationId: e.relationId,
        sliceId: e.to.sliceId,
        kind: e.kind,
        ...seg,
      })
    }
  }
  edgeSegments.value = segments
}

watch(
  [boardList, autoRmBySlice, () => props.lanesOn, () => props.fieldsOn],
  () => nextTick(measureEdges),
  { immediate: true },
)

let resizeObserver = null
onMounted(() => {
  resizeObserver = new ResizeObserver(() => measureEdges())
  if (gridEl.value) resizeObserver.observe(gridEl.value)
})

// --- intents ------------------------------------------------------------------
// Delete needs the BOX a selection came from (the same entity can sit in many
// boxes); remember the placement context of the last card click.
const lastPlacement = ref(null) // { sliceId, entityId } | null

function onSelectEntity(entityId, sliceId) {
  lastPlacement.value = { sliceId, entityId }
  emit('select-entity', entityId)
}

// Visuals-only pending set: pulses both cards while their swap mutation is in
// flight, never positions.
const inFlightSwaps = ref(new Set())

function requestSwap(sliceId, { entityIdA, entityIdB }) {
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

function onBackgroundClick() {
  lastPlacement.value = null
  emit('clear-selection')
}

// --- Delete key: remove the selected card's PLACEMENT (not the entity) -------
function onKeydown(e) {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
  const lp = lastPlacement.value
  if (!lp || props.selectedEntityId !== lp.entityId) return
  // Auto-displayed read models have no placement to remove — ignore Delete.
  const board = boardList.value.find((b) => b._id === lp.sliceId)
  if (!board?.placements?.some((p) => p.entityId === lp.entityId)) return
  lastPlacement.value = null
  emit('clear-selection')
  removePlacement
    .mutateAsync({ sliceId: lp.sliceId, placedId: lp.entityId })
    .catch((err) => {
      ui.pushBanner('error', err instanceof HttpError ? err.message || 'Could not remove the entity.' : 'Could not remove the entity.')
    })
}
window.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  resizeObserver?.disconnect()
})
</script>

<template>
  <div data-testid="model-canvas" class="relative h-full w-full overflow-hidden bg-gray-50/50">
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

    <!-- the giant table: native scroll, shared rows, subgrid slice columns -->
    <div class="h-full w-full overflow-auto" @click="onBackgroundClick">
      <div
        ref="gridEl"
        class="relative grid w-max items-stretch gap-x-0 p-8 pt-16"
        :style="{ gridAutoFlow: 'column', gridAutoColumns: 'max-content', gridTemplateRows: gridRows }"
      >
        <!-- lane-label gutter column (lanes layer on) -->
        <div
          v-if="lanesOn && boardList.length"
          class="grid grid-rows-[subgrid]"
          style="grid-row: 1 / -1"
        >
          <span
            v-for="(lane, i) in laneRows"
            :key="lane.laneId ?? 'none'"
            :data-testid="`lane-label-${lane.laneId ?? 'none'}`"
            :style="{ gridRow: `${5 + i}` }"
            class="max-w-28 self-start truncate pr-3 pt-3 text-[10px] font-medium uppercase tracking-wide text-gray-400"
          >
            {{ laneLabel(lane.laneId) }}
          </span>
        </div>

        <SliceFrame
          v-for="board in boardList"
          :key="board._id"
          :board="board"
          :lane-rows="laneRows"
          :lanes-on="lanesOn"
          :fields-on="fieldsOn"
          :chapters="chapters"
          :auto-rm="autoRmBySlice.get(board._id) ?? EMPTY_AUTO_RM"
          :catalog="catalog ?? []"
          :model-relations="modelRelations ?? []"
          :selected-entity-id="selectedEntityId"
          :in-flight-swaps="inFlightSwaps"
          @select-entity="(id) => onSelectEntity(id, board._id)"
          @select-scenario="(id) => emit('select-scenario', id)"
          @add-entity="(role) => emit('add-entity', { sliceId: board._id, role })"
          @add-scenario="(kind) => emit('add-scenario', { sliceId: board._id, kind })"
          @relate="(draft) => emit('draw-relation', draft)"
          @swap="(pair) => requestSwap(board._id, pair)"
          @rename="(name) => emit('rename-slice', { sliceId: board._id, name })"
          @archive="emit('archive-slice', { sliceId: board._id })"
          @assign-chapter="(chapterId) => emit('assign-chapter', { sliceId: board._id, chapterId })"
          @create-chapter="(name) => emit('create-chapter', { sliceId: board._id, name })"
        />

        <!-- relation arrows: straight lines, measured from card rects -->
        <svg class="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <marker id="edge-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" class="fill-gray-400" />
            </marker>
            <marker id="edge-arrow-selected" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" class="fill-brand" />
            </marker>
          </defs>
          <g v-for="seg in edgeSegments" :key="seg.id">
            <!-- wide invisible hit area so the thin line is clickable -->
            <line
              :x1="seg.x1" :y1="seg.y1" :x2="seg.x2" :y2="seg.y2"
              class="pointer-events-auto cursor-pointer stroke-transparent"
              stroke-width="12"
              @click.stop="emit('select-relation', seg.relationId)"
            />
            <line
              :data-testid="`edge-${seg.sliceId}-${seg.kind}`"
              :x1="seg.x1" :y1="seg.y1" :x2="seg.x2" :y2="seg.y2"
              class="stroke-[1.5]"
              :class="seg.relationId === selectedRelationId ? 'stroke-brand' : 'stroke-gray-400'"
              :marker-end="seg.relationId === selectedRelationId ? 'url(#edge-arrow-selected)' : 'url(#edge-arrow)'"
            />
            <!-- label at 65% toward the target — midpoints tend to sit on ghosts/cards -->
            <text
              :x="seg.x1 + (seg.x2 - seg.x1) * 0.65"
              :y="seg.y1 + (seg.y2 - seg.y1) * 0.65 - 4"
              text-anchor="middle"
              paint-order="stroke"
              class="fill-gray-500 stroke-white stroke-2 text-[10px]"
            >
              {{ seg.kind }}
            </text>
          </g>
        </svg>
      </div>
    </div>
  </div>
</template>
