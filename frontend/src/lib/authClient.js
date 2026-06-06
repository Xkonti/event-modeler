// LAYER 1 — transport singleton for auth. better-auth's Vue client.
//
// NO baseURL: dev is same-origin via the Vite proxy (it forwards /api/auth/* to
// the backend :3000), so the better-auth default basePath '/api/auth' resolves
// against the browser origin (:5173) and the session cookie is first-party.
// BETTER_AUTH_URL on the backend is the proxied/browser origin to match. See
// notes/auth-build-plan.md §1 (LOCKED contract) + §6 gotcha #2.
//
// If ever cross-origin in prod: createAuthClient({ baseURL: <backend origin> }).
//
// `useSession()` returns reactive refs ({ data, isPending, error }) and
// auto-fetches GET /api/auth/get-session. It is mirrored into the Pinia session
// store (stores/session.js) so router guards can read it synchronously.
import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient({})

export const { signIn, signUp, signOut, useSession } = authClient
