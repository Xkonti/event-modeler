// Navigation guard. Two jobs:
//   1. Wait for better-auth's session to finish its FIRST load before deciding.
//      useSession() starts isPending=true; without this await a hard refresh on
//      a guarded route would bounce a logged-in user to /login before the
//      session resolves. We resolve a one-shot "ready" promise via a watcher.
//   2. Redirect rules:
//        unauthenticated + non-public route → /login?redirect=<fullPath>
//        authenticated   + public route     → /home (keep authed users off
//                                              login/signup)
// See notes/frontend-architecture.md §7.
import { watch } from 'vue'
import { router } from './index'
import { useSessionStore } from '@/stores/session'

let readyOnce
/** Resolves once the session store reports isReady (first load done). */
function sessionReady(store) {
  if (store.isReady) return Promise.resolve()
  readyOnce ??= new Promise((resolve) => {
    const stop = watch(
      () => store.isReady,
      (ok) => {
        if (ok) {
          stop()
          resolve()
        }
      },
      { immediate: true },
    )
  })
  return readyOnce
}

export function installGuards() {
  router.beforeEach(async (to) => {
    const session = useSessionStore()
    await sessionReady(session)
    const authed = session.isAuthenticated
    if (!to.meta.public && !authed) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    if (to.meta.public && authed) {
      return { name: 'home' }
    }
    return true
  })
}
