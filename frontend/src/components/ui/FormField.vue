<script setup>
// Label + control slot + error text. Built on Reka's `Label` for a11y for/id
// wiring: we generate an id with Vue's useId(), bind it to the Label's `for`,
// and expose it to the slot so the control can set the same id.
//
// Usage:
//   <FormField label="Email" :error="emailErr" v-slot="{ id }">
//     <Input :id="id" type="email" v-model="email" />
//   </FormField>
import { Label } from 'reka-ui'
import { useId } from 'vue'

defineProps({
  label: { type: String, default: '' },
  error: { type: String, default: '' },
})

const id = useId()
</script>

<template>
  <div class="space-y-1">
    <Label :for="id" class="block text-sm font-medium text-gray-700">{{ label }}</Label>
    <slot :id="id" />
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
  </div>
</template>
