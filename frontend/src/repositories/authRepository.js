// LAYER 3 — auth domain repository. Pages/stores never import authClient
// directly; they go through here so better-auth's response shape is normalized
// into a uniform { ok, error } the forms can render.
//
// better-auth's signIn.email / signUp.email return { data, error } where `error`
// (when present) carries `.message` (and `.status`, e.g. 401 bad creds, 403
// unverified email, 422 validation). See notes/frontend-architecture.md §5.
//
// No colada here: auth has no app-API query/cache surface in v1 (session is
// owned by better-auth's reactive useSession, mirrored in stores/session.js).
import { signIn, signUp, signOut } from '@/lib/authClient'

/**
 * @param {{ email: string, password: string }} creds
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function login({ email, password }) {
  const { error } = await signIn.email({ email, password })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/**
 * @param {{ email: string, password: string, name: string }} input
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function register({ email, password, name }) {
  const { error } = await signUp.email({ email, password, name })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/**
 * Clears the session cookie server-side; reactive useSession flips to null so
 * the session store + guards react. Callers may also router.push('/login') to
 * be immediate.
 * @returns {Promise<void>}
 */
export async function logout() {
  await signOut()
}
