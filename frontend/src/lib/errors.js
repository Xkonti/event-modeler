// Mutation-error conventions (one place, every view uses this instead of
// hand-rolled catch blocks):
//   400  → inline form error (should be prevented client-side; banner fallback)
//   401  → session expired banner + redirect to login
//   404  → handled upstream by retry404 (projection lag); here = real missing
//   409 on Define<Type> → dup-name flow (caller-specific, NOT here — the
//        inspector looks up the catalog by normalized name and offers "use
//        existing"); every other 409 → generic conflict banner (the refetch
//        after invalidation shows the authoritative board)
//   422  → contextual banner with the server's error text (invalid pair,
//          cross-model ref, missing endpoint)
//   5xx / network → generic error banner
// Repositories never catch — colada rethrows via mutateAsync; views funnel
// errors here.
import { HttpError } from '@/lib/http'

/**
 * @param {{ pushBanner: (kind: string, text: string) => void }} ui ui store
 * @param {{ push: (to: unknown) => void }} router vue-router
 * @param {unknown} err
 * @param {string} fallback message when the error carries no useful text
 */
export function reportMutationError(ui, router, err, fallback) {
  if (err instanceof HttpError) {
    if (err.status === 401) {
      ui.pushBanner('error', 'Session expired — please log in again.')
      router.push({ name: 'login' })
      return
    }
    if (err.status === 422) {
      ui.pushBanner('error', err.message || fallback)
      return
    }
    if (err.status === 409) {
      ui.pushBanner('error', err.message || 'Conflict — the board was refreshed.')
      return
    }
  }
  ui.pushBanner('error', fallback)
}
