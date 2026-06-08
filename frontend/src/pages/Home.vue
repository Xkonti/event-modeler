<script setup>
// Authed landing placeholder (the future model UI mounts here). Rendered inside
// AppLayout's content slot. Greets the current user from the session store and
// offers a minimal "New slice" entry: define a slice (client-generated id) then
// route to its canvas. This is the only way to reach the canvas in v1.
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { useDefineSlice } from '@/repositories/sliceRepository'
import { HttpError } from '@/lib/http'
import Button from '@/components/ui/Button.vue'

const session = useSessionStore()
const router = useRouter()
const ui = useUiStore()
const defineSlice = useDefineSlice()

const creating = ref(false)

async function onNewSlice() {
  if (creating.value) return
  creating.value = true
  const entityId = crypto.randomUUID()
  try {
    await defineSlice.mutateAsync({ entityId, name: 'Untitled slice' })
    router.push(`/slices/${entityId}`)
  } catch (err) {
    const msg = err instanceof HttpError ? err.message || 'Could not create the slice.' : 'Could not create the slice.'
    ui.pushBanner('error', msg)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <section data-testid="home-page" class="space-y-4">
    <h1 class="text-2xl font-semibold text-gray-900">Home</h1>
    <p class="text-gray-600">
      Signed in as
      <span class="font-medium text-gray-900">{{ session.user?.name || session.user?.email }}</span>.
    </p>
    <p class="text-sm text-gray-500">Your event models will appear here.</p>

    <Button data-testid="new-slice" variant="primary" :disabled="creating" @click="onNewSlice">
      {{ creating ? 'Creating…' : 'New slice' }}
    </Button>
  </section>
</template>
