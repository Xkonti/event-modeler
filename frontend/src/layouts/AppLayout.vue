<script setup>
// Authenticated app shell: header (brand + user email + logout) + left sidebar
// nav + content slot. Testids per notes/auth-build-plan.md §5-StageF3:
//   app-shell (root), app-user-email (header), logout-button (header).
//
// Logout goes through authRepository.logout() (clears the cookie server-side →
// reactive useSession flips to null → guards react). We also router.push to
// /login immediately rather than waiting for the next guarded navigation.
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { logout } from '@/repositories/authRepository'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const session = useSessionStore()
const ui = useUiStore()

async function onLogout() {
  // Always navigate to /login, even if signOut() rejects (network blip / 5xx) —
  // otherwise the user is stranded on a stale authed shell with no feedback.
  try {
    await logout()
  } finally {
    router.push('/login')
  }
}
</script>

<template>
  <div data-testid="app-shell" class="flex min-h-screen flex-col bg-gray-50">
    <header class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <div class="flex items-center gap-3">
        <Button variant="ghost" class="md:hidden" @click="ui.toggleSidebar()">☰</Button>
        <RouterLink to="/" class="text-lg font-semibold text-gray-900">Event Modeler</RouterLink>
      </div>
      <div class="flex items-center gap-3">
        <span data-testid="app-user-email" class="text-sm text-gray-600">
          {{ session.user?.email }}
        </span>
        <Button data-testid="logout-button" variant="secondary" @click="onLogout">Log out</Button>
      </div>
    </header>

    <div class="flex flex-1">
      <aside
        v-show="!ui.sidebarCollapsed"
        class="w-56 shrink-0 border-r border-gray-200 bg-white p-4"
      >
        <nav class="space-y-1">
          <RouterLink
            to="/"
            class="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            active-class="bg-gray-100 text-gray-900"
          >
            Home
          </RouterLink>
        </nav>
      </aside>

      <main class="flex-1 p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
