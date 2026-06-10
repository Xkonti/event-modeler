<script setup>
// VIEW (canvas) — one slice as a SUBGRID column of the canvas "giant table"
// (notes/layout-and-rendering.md → "Rendering mechanism"). The frame spans all
// shared rows ([header] [trigger] [command] [lane × N] [strip]) and lays its
// cells on `grid-template-rows: subgrid`, so every band/lane row aligns with —
// and auto-sizes against — the same row in every other slice. No pixel math;
// the staircase time-offset is per-band padding. A plain component: events
// bubble normally (no provide/inject hub).
import { computed } from 'vue'
import EntityCard from '@/components/canvas/EntityCard.vue'
import GhostSlot from '@/components/canvas/GhostSlot.vue'
import ScenarioStrip from '@/components/canvas/ScenarioStrip.vue'
import { buildBands, relationOptions, buildStripModel } from '@/lib/layout/boardView'

const props = defineProps({
  board: { type: Object, required: true }, // slice DTO (GET /api/slices/:id)
  laneRows: { type: Array, required: true }, // shared rows from laneRowsFor
  lanesOn: { type: Boolean, default: false },
  fieldsOn: { type: Boolean, default: true },
  chapters: { type: Array, default: () => [] }, // [{_id, name}] creation order (C1 band)
  selectedEntityId: { type: String, default: null },
  inFlightSwaps: { type: Set, default: () => new Set() },
})

const emit = defineEmits([
  'select-entity', // entityId
  'select-scenario', // scenarioId
  'add-entity', // role
  'add-scenario', // kind
  'relate', // { fromId, toId }
  'swap', // { entityIdA, entityIdB }
  'rename', // name
  'archive',
  'assign-chapter', // chapterId | null (null = clear)
  'create-chapter', // name (then assign)
])

const bands = computed(() => buildBands(props.board.placements ?? [], props.laneRows))
const relOptions = computed(() =>
  relationOptions(props.board.placements ?? [], props.board.relations ?? []),
)
const strip = computed(() => buildStripModel(props.board.scenarios, props.board.placements))

const cardProps = (card) => ({
  card,
  sliceId: props.board._id,
  selected: props.selectedEntityId === card.entityId,
  pending: props.inFlightSwaps.has(card.entityId),
  fieldsOn: props.fieldsOn,
  relations: relOptions.value.get(card.entityId),
})

function onRename() {
  const name = window.prompt('Slice name', props.board.name)
  if (name && name.trim()) emit('rename', name.trim())
}
// C1: the chapter band select — assign / clear / inline-create.
function onChapterChange(event) {
  const value = event.target.value
  if (value === '__new__') {
    // Reset the select to the current assignment; the refetch confirms later.
    event.target.value = props.board.chapterId ?? ''
    const name = window.prompt('Chapter name')
    if (name && name.trim()) emit('create-chapter', name.trim())
    return
  }
  if (value === '') {
    if (props.board.chapterId) emit('assign-chapter', null)
    return
  }
  if (value !== props.board.chapterId) emit('assign-chapter', value)
}
function onArchive() {
  if (window.confirm(`Archive slice "${props.board.name || '(unnamed)'}"?`)) emit('archive')
}
</script>

<template>
  <div
    :data-testid="`slice-box-${board._id}`"
    class="grid min-w-[480px] grid-rows-[subgrid] rounded-lg border border-gray-300 bg-white shadow-sm"
    style="grid-row: 1 / -1"
  >
    <!-- chapter band row (C1) — the shared organizing band above the headers -->
    <div
      :data-testid="`chapter-band-${board._id}`"
      class="flex min-h-7 items-center rounded-t-lg border-b border-amber-200/70 bg-amber-50/70 px-3"
      @click.stop
    >
      <select
        :data-testid="`chapter-select-${board._id}`"
        class="w-full cursor-pointer truncate bg-transparent text-[11px] font-medium uppercase tracking-wide text-amber-700 focus:outline-none"
        :value="board.chapterId ?? ''"
        title="Chapter (organizing band)"
        @change="onChapterChange"
      >
        <option value="">(no chapter)</option>
        <option v-for="ch in chapters" :key="ch._id" :value="ch._id">{{ ch.name }}</option>
        <option value="__new__">+ new chapter…</option>
      </select>
    </div>

    <!-- header row -->
    <div class="flex min-h-9 items-center justify-between border-b border-gray-200 bg-gray-50 px-3">
      <!-- testid deliberately NOT slice-box-* — e2e selects boxes by that prefix. -->
      <span data-testid="slice-name" class="truncate text-sm font-semibold text-gray-800">
        {{ board.name || '(unnamed slice)' }}
      </span>
      <span class="flex items-center gap-1">
        <button
          :data-testid="`slice-rename-${board._id}`"
          class="rounded px-1.5 text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-700"
          title="Rename slice"
          @click.stop="onRename"
        >
          ✎
        </button>
        <button
          :data-testid="`slice-archive-${board._id}`"
          class="rounded px-1.5 text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-700"
          title="Archive slice"
          @click.stop="onArchive"
        >
          ⋯
        </button>
      </span>
    </div>

    <!-- trigger row -->
    <div class="flex flex-col gap-3 px-4 py-3">
      <EntityCard
        v-for="card in bands.trigger.cards"
        :key="card.entityId"
        v-bind="cardProps(card)"
        @select="emit('select-entity', card.entityId)"
        @swap="(otherId) => emit('swap', { entityIdA: card.entityId, entityIdB: otherId })"
        @relate="(draft) => emit('relate', draft)"
      />
      <GhostSlot v-if="bands.trigger.ghost" :ghost="bands.trigger.ghost" @add="(role) => emit('add-entity', role)" />
    </div>

    <!-- command row: command + read-model column to its right (staircase step 1) -->
    <div class="flex items-start gap-10 py-3 pl-16 pr-4">
      <div class="flex flex-col gap-3">
        <EntityCard
          v-if="bands.command.card"
          v-bind="cardProps(bands.command.card)"
          @select="emit('select-entity', bands.command.card.entityId)"
          @relate="(draft) => emit('relate', draft)"
        />
        <GhostSlot v-if="bands.command.ghost" :ghost="bands.command.ghost" @add="(role) => emit('add-entity', role)" />
      </div>
      <div class="flex flex-col gap-3">
        <EntityCard
          v-for="card in bands.readModels.cards"
          :key="card.entityId"
          v-bind="cardProps(card)"
          @select="emit('select-entity', card.entityId)"
          @swap="(otherId) => emit('swap', { entityIdA: card.entityId, entityIdB: otherId })"
          @relate="(draft) => emit('relate', draft)"
        />
        <GhostSlot :ghost="bands.readModels.ghost" @add="(role) => emit('add-entity', role)" />
      </div>
    </div>

    <!-- fact lane rows (staircase step 2); faint top divider between lanes -->
    <div
      v-for="(lane, i) in bands.factLanes"
      :key="lane.laneId ?? 'none'"
      class="flex flex-col gap-3 py-3 pl-28 pr-4"
      :class="lanesOn && i > 0 ? 'border-t border-dashed border-gray-200' : ''"
    >
      <EntityCard
        v-for="card in lane.cards"
        :key="card.entityId"
        v-bind="cardProps(card)"
        @select="emit('select-entity', card.entityId)"
        @swap="(otherId) => emit('swap', { entityIdA: card.entityId, entityIdB: otherId })"
        @relate="(draft) => emit('relate', draft)"
      />
      <GhostSlot v-if="lane.ghost" :ghost="lane.ghost" @add="(role) => emit('add-entity', role)" />
    </div>

    <!-- bottom text strip row -->
    <ScenarioStrip
      :slice-id="board._id"
      :strip="strip"
      @add-scenario="(kind) => emit('add-scenario', kind)"
      @select-scenario="(id) => emit('select-scenario', id)"
    />
  </div>
</template>
