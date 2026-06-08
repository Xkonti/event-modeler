<script setup>
// VIEW (canvas) — modal to define a new entity (business fact or command) and
// report it back to the canvas host. Reuses the ui Dialog/FormField/Input/Button
// primitives. This dialog ONLY defines the entity (POST /api/{business-facts|
// commands}); the host (SliceCanvas) places it on the slice afterward. That keeps
// the two sequential calls — define then place — owned where the position is
// known. The client generates the entity id so a place retry can reuse it.
//
// On HttpError the inline error surfaces (409 → duplicate name); no entity is
// emitted, so the host never tries to place a thing that failed to define.
import { ref, watch } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import FormField from '@/components/ui/FormField.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { HttpError } from '@/lib/http'
import { useDefineBusinessFact } from '@/repositories/businessFactRepository'
import { useDefineCommand } from '@/repositories/commandRepository'

const props = defineProps({
  // 'businessFact' | 'command'
  entityType: { type: String, required: true },
})
const open = defineModel('open', { type: Boolean, default: false })
const emit = defineEmits(['created'])

const defineFact = useDefineBusinessFact()
const defineCommand = useDefineCommand()

const name = ref('')
const context = ref('')
const error = ref('')
const submitting = ref(false)

// Reset the form whenever the dialog opens, so a reopened dialog is clean.
watch(open, (isOpen) => {
  if (isOpen) {
    name.value = ''
    context.value = ''
    error.value = ''
    submitting.value = false
  }
})

const titleByType = {
  businessFact: 'New business fact',
  command: 'New command',
}

async function onSubmit() {
  error.value = ''
  if (!name.value.trim()) {
    error.value = 'Name is required.'
    return
  }
  // Client-generated id (browser-native). Reused as entityId on place retry.
  const entityId = crypto.randomUUID()
  const payload = { entityId, name: name.value.trim(), context: context.value.trim() }
  submitting.value = true
  try {
    if (props.entityType === 'command') {
      await defineCommand.mutateAsync(payload)
    } else {
      await defineFact.mutateAsync(payload)
    }
    emit('created', { entityId, name: payload.name, entityType: props.entityType })
    open.value = false
  } catch (err) {
    if (err instanceof HttpError && err.status === 409) {
      error.value = 'An entity with that name already exists.'
    } else if (err instanceof HttpError) {
      error.value = err.message || 'Could not create the entity.'
    } else {
      error.value = 'Could not create the entity.'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open" :title="titleByType[entityType] || 'New entity'">
    <form data-testid="create-entity-dialog" class="space-y-4" @submit.prevent="onSubmit">
      <FormField label="Name" :error="error" v-slot="{ id }">
        <Input :id="id" v-model="name" data-testid="create-entity-name" />
      </FormField>

      <FormField label="Context (optional)" v-slot="{ id }">
        <Input :id="id" v-model="context" data-testid="create-entity-context" />
      </FormField>

      <div class="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" @click="open = false">Cancel</Button>
        <Button
          type="submit"
          variant="primary"
          data-testid="create-entity-submit"
          :disabled="submitting"
        >
          {{ submitting ? 'Creating…' : 'Create' }}
        </Button>
      </div>
    </form>
  </Dialog>
</template>
