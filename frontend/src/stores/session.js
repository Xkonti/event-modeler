// LAYER 4 — Pinia store, client-truth only. Mirrors better-auth's reactive
// useSession() into a canonical place router guards can read SYNCHRONOUSLY
// (guards run outside component setup). No server lists cached here — that's
// colada's job. See notes/frontend-architecture.md §4 + §7.
//
// useSession() returns { data, isPending, error } refs and auto-fetches
// GET /api/auth/get-session on first use, revalidating on focus. The guard
// awaits `isReady` once before letting navigation through (guard.js, stage F3),
// so a hard refresh doesn't bounce a logged-in user to /login.
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useSession } from '@/lib/authClient'

export const useSessionStore = defineStore('session', () => {
  const session = useSession() // reactive ref: { data, isPending, error }

  const user = computed(() => session.value.data?.user ?? null)
  const isAuthenticated = computed(() => !!session.value.data?.user)
  const isReady = computed(() => !session.value.isPending)

  return { raw: session, user, isAuthenticated, isReady }
})
