<script setup>
// VIEW (inspector) — the fields grid for schema-bearing types (fact / external
// fact / command / read model). Field TYPES are free-form text (O4 — no enum,
// the completeness check is semantic). v-model:fields = [{fieldName, fieldType}].
const fields = defineModel('fields', { type: Array, default: () => [] })

function addRow() {
  fields.value = [...fields.value, { fieldName: '', fieldType: '' }]
}
function removeRow(i) {
  fields.value = fields.value.filter((_, idx) => idx !== i)
}
function update(i, key, value) {
  fields.value = fields.value.map((f, idx) => (idx === i ? { ...f, [key]: value } : f))
}
</script>

<template>
  <div class="space-y-1.5">
    <p class="text-sm font-medium text-gray-700">Fields</p>
    <div
      v-for="(field, i) in fields"
      :key="i"
      class="flex items-center gap-1.5"
    >
      <input
        :data-testid="`field-name-${i}`"
        :value="field.fieldName"
        placeholder="name"
        class="w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
        @input="update(i, 'fieldName', $event.target.value)"
      />
      <span class="text-gray-400">:</span>
      <input
        :data-testid="`field-type-${i}`"
        :value="field.fieldType"
        placeholder="type (free text)"
        class="w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
        @input="update(i, 'fieldType', $event.target.value)"
      />
      <button
        class="rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        title="Remove field"
        @click="removeRow(i)"
      >
        ✕
      </button>
    </div>
    <button
      data-testid="add-field"
      class="rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-brand hover:text-brand"
      @click="addRow"
    >
      + Add field
    </button>
  </div>
</template>
