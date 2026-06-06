// LAYER 1 — transport. The ONLY module that touches `fetch` for the app API.
// Same-origin in dev via the Vite proxy (see notes/auth-build-plan.md §1 + §6
// gotcha #2): base is '' and Vite forwards /api/* to the backend (:3000), so the
// session cookie stays first-party. `credentials:'include'` is set anyway so it
// also works behind a cross-origin reverse proxy in prod if ever needed.
//
// better-auth/vue has its OWN fetch internally and does NOT go through here — see
// lib/authClient.js. This client is for the app API only (paths under /api/*).

export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {unknown} body parsed JSON body (or null)
   */
  constructor(status, message, body) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}

const BASE = '' // same-origin; Vite proxy forwards /api/* to the backend

/**
 * Low-level request. Parses JSON, throws HttpError on non-2xx so colada's
 * `error` ref is a consistent shape.
 * @param {string} path absolute app path, e.g. '/api/business-facts/123'
 * @param {RequestInit} [init]
 * @returns {Promise<any>} parsed body (or null on empty response)
 */
export async function request(path, init = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    const msg = body?.error || body?.message || res.statusText
    throw new HttpError(res.status, msg, body)
  }
  return body
}

export const http = {
  /** @param {string} p */
  get: (p) => request(p),
  /** @param {string} p @param {unknown} data */
  post: (p, data) => request(p, { method: 'POST', body: JSON.stringify(data) }),
  /** @param {string} p @param {unknown} data */
  put: (p, data) => request(p, { method: 'PUT', body: JSON.stringify(data) }),
  /** @param {string} p */
  del: (p) => request(p, { method: 'DELETE' }),
}
