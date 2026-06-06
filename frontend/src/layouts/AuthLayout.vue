<script setup>
// Full-screen centered single-card layout for the auth pages (login / signup).
// No header/sidebar. The page renders inside the Card via <router-view>
// (App.vue places <router-view> as this layout's default slot).
import Card from '@/components/ui/Card.vue'
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-sm">
      <h1 class="mb-6 text-center text-2xl font-semibold text-gray-900">Event Modeler</h1>
      <Card>
        <slot />
      </Card>
    </div>
  </div>
</template>
