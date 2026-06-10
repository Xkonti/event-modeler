<script setup>
// VIEW (inspector host, W5/6 shell) — switches the right pane on what's active:
// relation/scenario DRAFTS (from canvas gestures) win, then the workspace
// store's entity draft (palette/place-dialog create), then the selection
// (entity / relation / scenario), else an empty hint. EntityInspector is
// RE-KEYED per entity+mode so its per-type composables stay stable per
// instance.
import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import EntityInspector from '@/components/inspector/EntityInspector.vue'
import RelationInspector from '@/components/inspector/RelationInspector.vue'
import ScenarioEditor from '@/components/inspector/ScenarioEditor.vue'

const props = defineProps({
  modelId: { type: String, required: true },
  catalog: { type: Array, default: () => [] },
  contexts: { type: Array, default: () => [] },
  relationDraft: { type: Object, default: null },
  scenarioDraft: { type: Object, default: null },
})
defineEmits(['close-relation-draft', 'close-scenario-draft'])

const workspace = useWorkspaceStore()

// Selected entity's type comes from the catalog (selection stores only the id).
const selectedEntity = computed(() =>
  workspace.selectedEntityId
    ? props.catalog.find((e) => e._id === workspace.selectedEntityId) ?? null
    : null,
)
</script>

<template>
  <div data-testid="inspector-pane" class="h-full">
    <RelationInspector
      v-if="relationDraft"
      :model-id="modelId"
      :draft="relationDraft"
      :catalog="catalog"
      @close-draft="$emit('close-relation-draft')"
    />

    <ScenarioEditor
      v-else-if="scenarioDraft"
      :model-id="modelId"
      :draft="scenarioDraft"
      :catalog="catalog"
      @close-draft="$emit('close-scenario-draft')"
    />

    <EntityInspector
      v-else-if="workspace.draft"
      :key="`create:${workspace.draft.entityId}`"
      :model-id="modelId"
      :entity-type="workspace.draft.entityType"
      :entity-id="workspace.draft.entityId"
      mode="create"
      :place-into-slice-id="workspace.draft.placeIntoSliceId ?? null"
      :catalog="catalog"
      :contexts="contexts"
    />

    <EntityInspector
      v-else-if="selectedEntity"
      :key="`edit:${selectedEntity._id}`"
      :model-id="modelId"
      :entity-type="selectedEntity.entityType"
      :entity-id="selectedEntity._id"
      mode="edit"
      :catalog="catalog"
      :contexts="contexts"
    />

    <RelationInspector
      v-else-if="workspace.selectedRelationId"
      :key="`rel:${workspace.selectedRelationId}`"
      :model-id="modelId"
      :relation-id="workspace.selectedRelationId"
      :catalog="catalog"
    />

    <ScenarioEditor
      v-else-if="workspace.selectedScenarioId"
      :key="`sc:${workspace.selectedScenarioId}`"
      :model-id="modelId"
      :scenario-id="workspace.selectedScenarioId"
      :catalog="catalog"
    />

    <div v-else data-testid="inspector-empty" class="flex h-full items-center justify-center p-6 text-center text-sm text-gray-400">
      Select an element on the canvas or in the palette — or create one with the + buttons.
    </div>
  </div>
</template>
