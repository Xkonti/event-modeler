<script setup>
// Styled text input with `v-model` passthrough via defineModel. `id`/`type` etc.
// fall through to the native <input> as plain attrs (no inheritAttrs override
// needed — single root element). FormField wires `id` for label a11y.
const model = defineModel({ type: String, default: '' })

defineProps({
  type: { type: String, default: 'text' },
})
</script>

<template>
  <input
    v-model="model"
    :type="type"
    class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
  />
</template>
