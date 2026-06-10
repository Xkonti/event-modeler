<script setup>
// VIEW (canvas) — a plain auto-sized entity card in its band cell. No graph
// lib: a regular component, events bubble normally. Name wraps (never
// truncates); fields render INLINE on the card when the fields layer is on —
// details are just there, no selection needed. Colored per the event-modeling
// convention, 7 types incl. YELLOW external facts.
//
// Interactions, all dumb buttons:
//   - click → select
//   - ▲▼ → slot swap with the same-band/lane neighbour (e2e-stable reorder)
//   - ← / → → create a relation (replaces drag-to-connect): ← picks an
//     incoming SOURCE, → picks an outgoing TARGET. One legal candidate →
//     connect immediately; several → a small picker menu.
import { computed, ref } from 'vue'

const props = defineProps({
  card: { type: Object, required: true }, // boardView card
  sliceId: { type: String, required: true },
  selected: { type: Boolean, default: false },
  pending: { type: Boolean, default: false }, // swap in flight → pulse
  fieldsOn: { type: Boolean, default: true },
  relations: {
    type: Object,
    default: () => ({ incoming: [], outgoing: [] }), // relationOptions entry
  },
})

const emit = defineEmits(['select', 'swap', 'relate'])

// Per event-modeling color convention (em book): facts orange, EXTERNAL facts
// yellow, commands blue, read models green, wireframes white, automations
// purple, translations teal.
const palette = {
  businessFact: { chip: 'bg-orange-100 text-orange-800', body: 'border-orange-300 bg-orange-50', label: 'Fact' },
  externalBusinessFact: { chip: 'bg-yellow-100 text-yellow-800', body: 'border-yellow-400 bg-yellow-50', label: 'External' },
  command: { chip: 'bg-blue-100 text-blue-800', body: 'border-blue-300 bg-blue-50', label: 'Command' },
  readModel: { chip: 'bg-green-100 text-green-800', body: 'border-green-300 bg-green-50', label: 'Read model' },
  wireframe: { chip: 'bg-gray-100 text-gray-700', body: 'border-gray-300 bg-white', label: 'Wireframe' },
  automation: { chip: 'bg-purple-100 text-purple-800', body: 'border-purple-300 bg-purple-50', label: 'Automation' },
  translation: { chip: 'bg-teal-100 text-teal-800', body: 'border-teal-300 bg-teal-50', label: 'Translation' },
}
const fallback = { chip: 'bg-gray-100 text-gray-700', body: 'border-gray-300 bg-white', label: 'Entity' }
const skin = computed(() => palette[props.card.entityType] ?? fallback)

const fields = computed(() => (props.fieldsOn && props.card.fields?.length ? props.card.fields : null))

// Relation picker: which side's menu is open ('in' | 'out' | null).
const openMenu = ref(null)

function onRelate(side) {
  const options = side === 'in' ? props.relations.incoming : props.relations.outgoing
  if (options.length === 1) {
    pick(side, options[0])
  } else {
    openMenu.value = openMenu.value === side ? null : side
  }
}

function pick(side, option) {
  openMenu.value = null
  emit(
    'relate',
    side === 'in'
      ? { fromId: option.entityId, toId: props.card.entityId }
      : { fromId: props.card.entityId, toId: option.entityId },
  )
}
</script>

<template>
  <div
    :data-testid="`node-${card.entityId}`"
    :data-entity-id="card.entityId"
    :data-card="`${sliceId}:${card.entityId}`"
    class="group relative w-fit min-w-44 max-w-[220px] rounded-md border px-3 py-2 shadow-sm transition"
    :class="[skin.body, selected ? 'ring-2 ring-brand ring-offset-1' : '', pending ? 'animate-pulse opacity-70' : '']"
    @click.stop="emit('select')"
    @mouseleave="openMenu = null"
  >
    <div class="flex items-start justify-between gap-2">
      <span data-testid="node-name" class="break-words text-sm font-medium text-gray-900">
        {{ card.name }}
      </span>
      <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" :class="skin.chip">
        {{ skin.label }}
      </span>
    </div>

    <!-- inline fields (the fields layer) — visible without selecting anything -->
    <ul v-if="fields" :data-testid="`node-fields-${card.entityId}`" class="mt-1.5 space-y-0.5 border-t border-black/10 pt-1.5">
      <li v-for="f in fields" :key="f.fieldName" class="flex justify-between gap-2 font-mono text-[10px] leading-4 text-gray-600">
        <!-- ƒ marks a DERIVED field (F7): computed, exempt from the source check -->
        <span class="truncate" :class="f.derived ? 'italic text-gray-500' : ''">
          <span v-if="f.derived" class="mr-0.5 text-brand" title="Derived (computed)">ƒ</span>{{ f.fieldName }}
        </span>
        <span class="shrink-0 text-gray-400">{{ f.fieldType }}</span>
      </li>
    </ul>

    <!-- relation buttons: ← incoming source | → outgoing target -->
    <div
      v-if="relations.incoming.length || relations.outgoing.length"
      class="mt-1.5 flex items-center justify-between"
    >
      <button
        v-if="relations.incoming.length"
        :data-testid="`relate-in-${card.entityId}`"
        class="rounded border border-gray-300 bg-white px-1.5 text-[11px] leading-4 text-gray-500 opacity-0 shadow-sm transition hover:bg-gray-50 hover:text-gray-800 focus:opacity-100 group-hover:opacity-100"
        :class="openMenu === 'in' ? 'opacity-100' : ''"
        title="Connect from… (incoming)"
        @click.stop="onRelate('in')"
      >
        ←
      </button>
      <span v-else />
      <button
        v-if="relations.outgoing.length"
        :data-testid="`relate-out-${card.entityId}`"
        class="rounded border border-gray-300 bg-white px-1.5 text-[11px] leading-4 text-gray-500 opacity-0 shadow-sm transition hover:bg-gray-50 hover:text-gray-800 focus:opacity-100 group-hover:opacity-100"
        :class="openMenu === 'out' ? 'opacity-100' : ''"
        title="Connect to… (outgoing)"
        @click.stop="onRelate('out')"
      >
        →
      </button>
    </div>

    <!-- candidate picker (only when a side has several legal candidates) -->
    <div
      v-if="openMenu"
      class="absolute left-0 top-full z-30 mt-1 w-max min-w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg"
    >
      <button
        v-for="option in openMenu === 'in' ? relations.incoming : relations.outgoing"
        :key="option.entityId"
        :data-testid="`relate-option-${option.entityId}`"
        class="block w-full px-3 py-1 text-left text-xs text-gray-700 hover:bg-gray-50"
        @click.stop="pick(openMenu, option)"
      >
        {{ openMenu === 'in' ? '←' : '→' }} {{ option.name }}
      </button>
    </div>

    <!-- ▲▼ swap-with-neighbour (only when a same-band/lane sibling exists) -->
    <div
      v-if="card.swapUpId || card.swapDownId"
      class="absolute -right-2 top-1/2 z-10 flex -translate-y-1/2 translate-x-full flex-col gap-0.5 opacity-0 transition group-hover:opacity-100"
    >
      <button
        v-if="card.swapUpId"
        :data-testid="`swap-up-${card.entityId}`"
        class="rounded border border-gray-300 bg-white px-1 text-[10px] leading-4 text-gray-600 shadow-sm hover:bg-gray-50"
        title="Swap with the card above"
        @click.stop="emit('swap', card.swapUpId)"
      >
        ▲
      </button>
      <button
        v-if="card.swapDownId"
        :data-testid="`swap-down-${card.entityId}`"
        class="rounded border border-gray-300 bg-white px-1 text-[10px] leading-4 text-gray-600 shadow-sm hover:bg-gray-50"
        title="Swap with the card below"
        @click.stop="emit('swap', card.swapDownId)"
      >
        ▼
      </button>
    </div>
  </div>
</template>
