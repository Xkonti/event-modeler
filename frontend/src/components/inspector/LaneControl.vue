<script setup>
// VIEW (inspector) — the Lane (Context/swimlane) control, FACTS ONLY. Assign /
// clear the fact's lane; "+ new lane" defines a Context inline then assigns it
// (two awaited mutations — v1 creates lanes from here, the standalone manager
// is later). External facts use the exact same path (O5).
import { ref } from 'vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps({
  contexts: { type: Array, default: () => [] }, // [{_id, name}]
  contextId: { type: String, default: null }, // current lane
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['assign', 'clear', 'create-and-assign'])

const newLaneOpen = ref(false)
const newLaneName = ref('')

function onPick(e) {
  const v = e.target.value
  if (v) emit('assign', v)
}
function onCreate() {
  const name = newLaneName.value.trim()
  if (!name) return
  emit('create-and-assign', name)
  newLaneOpen.value = false
  newLaneName.value = ''
}
</script>

<template>
  <div class="space-y-1.5">
    <p class="text-sm font-medium text-gray-700">Lane</p>
    <div class="flex items-center gap-1.5">
      <select
        data-testid="lane-select"
        class="w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
        :value="contextId ?? ''"
        :disabled="busy"
        @change="onPick"
      >
        <option value="" disabled>(no lane)</option>
        <option v-for="ctx in contexts" :key="ctx._id" :value="ctx._id">{{ ctx.name }}</option>
      </select>
      <Button
        v-if="contextId"
        data-testid="lane-clear"
        variant="ghost"
        :disabled="busy"
        @click="emit('clear')"
      >
        Clear
      </Button>
    </div>

    <button
      v-if="!newLaneOpen"
      data-testid="lane-new"
      class="rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-brand hover:text-brand"
      @click="newLaneOpen = true"
    >
      + New lane
    </button>
    <div v-else class="flex items-center gap-1.5">
      <input
        data-testid="lane-new-name"
        v-model="newLaneName"
        placeholder="Lane name"
        class="w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
        @keydown.enter.prevent="onCreate"
      />
      <Button data-testid="lane-new-save" variant="secondary" :disabled="busy" @click="onCreate">
        Add
      </Button>
    </div>
  </div>
</template>
