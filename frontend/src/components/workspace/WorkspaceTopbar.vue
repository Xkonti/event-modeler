<script setup>
// VIEW — W3 topbar: breadcrumb (model name), the lanes presentation toggle
// (swimlanes are a toggleable layer, OFF by default in early planning), the
// on-demand "Check model" validation trigger, and Export (same O1 query as the
// dashboard button).
import { useWorkspaceStore } from '@/stores/workspace'
import Button from '@/components/ui/Button.vue'

defineProps({
  modelName: { type: String, default: '' },
  exporting: { type: Boolean, default: false },
})
const emit = defineEmits(['check-model', 'export'])

const workspace = useWorkspaceStore()
</script>

<template>
  <header class="flex h-12 items-center gap-3 border-b border-gray-200 bg-white px-4">
    <nav class="min-w-0 flex-1 truncate text-sm text-gray-600">
      <router-link to="/" class="hover:text-gray-900">Models</router-link>
      <span class="mx-1 text-gray-400">▸</span>
      <span data-testid="workspace-breadcrumb" class="font-medium text-gray-900">{{ modelName }}</span>
    </nav>

    <label class="flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
      <input
        data-testid="lanes-toggle"
        type="checkbox"
        class="accent-brand"
        :checked="workspace.lanesVisible"
        @change="workspace.toggleLanes()"
      />
      Lanes
    </label>

    <label class="flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
      <input
        data-testid="fields-toggle"
        type="checkbox"
        class="accent-brand"
        :checked="workspace.fieldsVisible"
        @change="workspace.toggleFields()"
      />
      Fields
    </label>

    <Button
      data-testid="check-model"
      variant="secondary"
      @click="emit('check-model')"
    >
      Check model
    </Button>
    <Button data-testid="workspace-export" variant="secondary" :disabled="exporting" @click="emit('export')">
      {{ exporting ? 'Exporting…' : 'Export' }}
    </Button>
  </header>
</template>
