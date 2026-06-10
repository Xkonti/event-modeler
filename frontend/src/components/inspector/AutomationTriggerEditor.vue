<script setup>
// VIEW (inspector) — automation trigger config (G3: ReconfigureAutomation, no
// generic fields): WHAT fires it (a fact arriving / a timer / a user
// interaction), WHICH read model it monitors, WHICH command it issues. The
// pickers are catalog-filtered by type; the structural wiring stays the drawn
// relations — these refs are the automation's own definition.
const config = defineModel('config', {
  type: Object,
  default: () => ({ triggerType: 'interaction' }),
})

defineProps({
  catalog: { type: Array, default: () => [] },
})

function set(key, value) {
  config.value = { ...config.value, [key]: value || undefined }
}
</script>

<template>
  <div class="space-y-2">
    <p class="text-sm font-medium text-gray-700">Trigger</p>
    <select
      data-testid="trigger-type"
      class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
      :value="config.triggerType"
      @change="set('triggerType', $event.target.value)"
    >
      <option value="fact">fact — a business fact is emitted</option>
      <option value="timer">timer — on a schedule</option>
      <option value="interaction">interaction — explicit trigger</option>
    </select>

    <label class="block text-xs text-gray-500">Monitors read model</label>
    <select
      data-testid="trigger-monitored"
      class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
      :value="config.monitoredReadModelId ?? ''"
      @change="set('monitoredReadModelId', $event.target.value)"
    >
      <option value="">(none)</option>
      <option
        v-for="e in catalog.filter((c) => c.entityType === 'readModel')"
        :key="e._id"
        :value="e._id"
      >
        {{ e.name }}
      </option>
    </select>

    <label class="block text-xs text-gray-500">Issues command</label>
    <select
      data-testid="trigger-issued"
      class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
      :value="config.issuedCommandId ?? ''"
      @change="set('issuedCommandId', $event.target.value)"
    >
      <option value="">(none)</option>
      <option
        v-for="e in catalog.filter((c) => c.entityType === 'command')"
        :key="e._id"
        :value="e._id"
      >
        {{ e.name }}
      </option>
    </select>
  </div>
</template>
