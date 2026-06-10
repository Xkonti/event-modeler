<script setup>
// VIEW (inspector) — translation mapping (G3: UpdateTranslationMapping): the
// anti-corruption field table. Direction (inbound external→internal / outbound
// internal→external) + external↔internal field pairs.
const mapping = defineModel('mapping', {
  type: Object,
  default: () => ({ direction: 'inbound', pairs: [] }),
})

function setDirection(direction) {
  mapping.value = { ...mapping.value, direction }
}
function addPair() {
  mapping.value = {
    ...mapping.value,
    pairs: [...(mapping.value.pairs ?? []), { externalField: '', internalField: '' }],
  }
}
function removePair(i) {
  mapping.value = {
    ...mapping.value,
    pairs: mapping.value.pairs.filter((_, idx) => idx !== i),
  }
}
function update(i, key, value) {
  mapping.value = {
    ...mapping.value,
    pairs: mapping.value.pairs.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)),
  }
}
</script>

<template>
  <div class="space-y-2">
    <p class="text-sm font-medium text-gray-700">Mapping</p>
    <select
      data-testid="mapping-direction"
      class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
      :value="mapping.direction"
      @change="setDirection($event.target.value)"
    >
      <option value="inbound">inbound — external → internal</option>
      <option value="outbound">outbound — internal → external</option>
    </select>

    <div
      v-for="(pair, i) in mapping.pairs ?? []"
      :key="i"
      class="flex items-center gap-1.5"
    >
      <input
        :data-testid="`mapping-external-${i}`"
        :value="pair.externalField"
        placeholder="external field"
        class="w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
        @input="update(i, 'externalField', $event.target.value)"
      />
      <span class="text-gray-400">↔</span>
      <input
        :data-testid="`mapping-internal-${i}`"
        :value="pair.internalField"
        placeholder="internal field"
        class="w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
        @input="update(i, 'internalField', $event.target.value)"
      />
      <button
        class="rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        title="Remove pair"
        @click="removePair(i)"
      >
        ✕
      </button>
    </div>
    <button
      data-testid="mapping-add-pair"
      class="rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-brand hover:text-brand"
      @click="addPair"
    >
      + Add pair
    </button>
  </div>
</template>
