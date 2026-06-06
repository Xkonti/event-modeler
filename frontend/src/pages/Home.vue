<script setup>
// Authed landing placeholder (the future model UI mounts here). Rendered inside
// AppLayout's content slot. Greets the current user from the session store.
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
</script>

<template>
  <section data-testid="home-page" class="space-y-2">
    <h1 class="text-2xl font-semibold text-gray-900">Home</h1>
    <p class="text-gray-600">
      Signed in as
      <span class="font-medium text-gray-900">{{ session.user?.name || session.user?.email }}</span>.
    </p>
    <p class="text-sm text-gray-500">Your event models will appear here.</p>
  </section>
</template>
