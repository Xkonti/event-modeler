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

  // Force a refetch of GET /api/auth/get-session so the reactive session reflects
  // a just-set cookie (after signup/login) BEFORE a guard reads it — otherwise the
  // guard sees stale unauthenticated state and bounces a freshly-authed user to
  // /login. better-auth's useSession exposes refetch on its reactive value.
  const refresh = () => session.value.refetch?.()

  return { raw: session, user, isAuthenticated, isReady, refresh }
})
