<script setup>
// W2 — Model Dashboard. Lists the user's models (name + sliceCount), creates /
// renames / archives them, and exports a model as JSON (O1 state-view query —
// the v1 save path). Open routes into the W3 workspace (/models/:id), whose
// useModel retry404 absorbs the create→projection lag.
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import {
  useModels,
  useCreateModel,
  useRenameModel,
  useArchiveModel,
  exportModel,
} from '@/repositories/modelRepository'
import { downloadJson } from '@/lib/download'
import { reportMutationError } from '@/lib/errors'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import FormField from '@/components/ui/FormField.vue'
import Input from '@/components/ui/Input.vue'

const router = useRouter()
const ui = useUiStore()

const { data: models, isPending } = useModels()
const createModel = useCreateModel()
const renameModel = useRenameModel()
const archiveModel = useArchiveModel()

// --- new model dialog ---
const newOpen = ref(false)
const newName = ref('')
const newError = ref('')

async function onCreate() {
  const name = newName.value.trim()
  if (!name) {
    newError.value = 'Name is required.'
    return
  }
  try {
    const { modelId } = await createModel.mutateAsync({ name })
    newOpen.value = false
    newName.value = ''
    newError.value = ''
    router.push(`/models/${modelId}`)
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not create the model.')
  }
}

// --- rename dialog ---
const renameTarget = ref(null) // { modelId, name } | null
const renameName = ref('')

function openRename(model) {
  renameTarget.value = { modelId: model._id, name: model.name }
  renameName.value = model.name
}

async function onRename() {
  const name = renameName.value.trim()
  if (!name || !renameTarget.value) return
  try {
    await renameModel.mutateAsync({ modelId: renameTarget.value.modelId, name })
    renameTarget.value = null
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not rename the model.')
  }
}

// --- archive ---
async function onArchive(model) {
  if (!window.confirm(`Archive "${model.name}"? It disappears from this list.`)) return
  try {
    await archiveModel.mutateAsync({ modelId: model._id })
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not archive the model.')
  }
}

// --- export (O1) ---
const exportingId = ref(null)
async function onExport(model) {
  exportingId.value = model._id
  try {
    const data = await exportModel(model._id)
    const slug = model.name.trim().toLowerCase().replace(/\s+/g, '-') || 'model'
    downloadJson(`${slug}.event-model.json`, data)
  } catch (err) {
    reportMutationError(ui, router, err, 'Could not export the model.')
  } finally {
    exportingId.value = null
  }
}
</script>

<template>
  <section data-testid="home-page" class="mx-auto max-w-3xl space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-gray-900">My Models</h1>
      <Button data-testid="new-model" variant="primary" @click="newOpen = true">
        + New Model
      </Button>
    </div>

    <p v-if="isPending" class="text-sm text-gray-500">Loading models…</p>
    <p
      v-else-if="!models?.length"
      data-testid="models-empty"
      class="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500"
    >
      No models yet — create one to start modeling.
    </p>

    <ul v-else data-testid="model-list" class="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
      <li
        v-for="model in models"
        :key="model._id"
        :data-testid="`model-row-${model._id}`"
        class="flex items-center gap-3 px-4 py-3"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-gray-900" data-testid="model-name">{{ model.name }}</p>
          <p class="text-xs text-gray-500">
            {{ model.sliceCount }} slice{{ model.sliceCount === 1 ? '' : 's' }}
          </p>
        </div>
        <Button
          :data-testid="`model-open-${model._id}`"
          variant="primary"
          @click="router.push(`/models/${model._id}`)"
        >
          Open
        </Button>
        <Button
          :data-testid="`model-export-${model._id}`"
          variant="secondary"
          :disabled="exportingId === model._id"
          @click="onExport(model)"
        >
          {{ exportingId === model._id ? 'Exporting…' : 'Export' }}
        </Button>
        <Button :data-testid="`model-rename-${model._id}`" variant="ghost" @click="openRename(model)">
          Rename
        </Button>
        <Button :data-testid="`model-archive-${model._id}`" variant="ghost" @click="onArchive(model)">
          Archive
        </Button>
      </li>
    </ul>

    <Dialog v-model:open="newOpen" title="New model">
      <form class="space-y-4" @submit.prevent="onCreate">
        <FormField label="Name" :error="newError" v-slot="{ id }">
          <Input :id="id" v-model="newName" data-testid="new-model-name" placeholder="e.g. Budgeting" />
        </FormField>
        <Button type="submit" data-testid="new-model-submit" :disabled="createModel.isLoading?.value">
          Create
        </Button>
      </form>
    </Dialog>

    <Dialog
      :open="renameTarget !== null"
      title="Rename model"
      @update:open="(v) => !v && (renameTarget = null)"
    >
      <form class="space-y-4" @submit.prevent="onRename">
        <FormField label="Name" v-slot="{ id }">
          <Input :id="id" v-model="renameName" data-testid="rename-model-name" />
        </FormField>
        <Button type="submit" data-testid="rename-model-submit">Save</Button>
      </form>
    </Dialog>
  </section>
</template>
