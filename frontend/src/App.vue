<script setup>
// Root shell. Resolves the layout component from route.meta.layout and renders
// <router-view> inside it. Default layout is the app shell (guarded routes).
// See notes/frontend-architecture.md §7.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'

const layouts = { app: AppLayout, auth: AuthLayout }
const route = useRoute()
const layout = computed(() => layouts[route.meta.layout] ?? AppLayout)
</script>

<template>
  <component :is="layout">
    <router-view />
  </component>
</template>
