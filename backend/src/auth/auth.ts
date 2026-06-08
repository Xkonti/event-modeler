import { betterAuth } from 'better-auth';
import { betterAuthUrl, trustedOrigins, isProduction } from '../config.ts';
import { BETTER_AUTH_SECRET } from './keys.ts';
import { eventStore } from '../eventStore.ts';
import { esCryptoAdapter } from './adapter.ts';

/**
 * The better-auth instance (notes/auth-architecture.md).
 *
 * - `database`: our event-sourced + crypto-shred adapter (createAdapterFactory),
 *   bound to the app event store. user/account are ES + shredded; session/
 *   verification are plain Postgres tables.
 * - email+password ON, email verification OFF (v1).
 * - `baseURL` = the BROWSER-FACING / Vite-proxied origin (`:5173` in dev) so
 *   issued cookies match the origin the browser uses. Backend still binds
 *   `:3000`; Vite forwards `/api`.
 * - `basePath` kept explicit at the default `/api/auth` (the locked mount path).
 * - `cookiePrefix` left DEFAULT → session cookie prefix `better-auth.session_token`
 *   (tests assert by PREFIX, never exact).
 * - `advanced.useSecureCookies` forced ON in production so the session cookie
 *   always carries `Secure` regardless of how `baseURL` is derived behind a
 *   TLS-terminating proxy. Dev stays off (http localhost via the Vite proxy;
 *   browsers still send a `sameSite=lax` cookie same-origin).
 *
 * Importing this module triggers keys.ts env validation (AUTH_KEK,
 * EMAIL_INDEX_KEY, BETTER_AUTH_SECRET must be present) — both index.ts and the
 * integration harness set those before importing.
 */
export const auth = betterAuth({
  database: esCryptoAdapter(eventStore),
  secret: BETTER_AUTH_SECRET,
  baseURL: betterAuthUrl,
  basePath: '/api/auth',
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  trustedOrigins,
  advanced: {
    useSecureCookies: isProduction,
  },
});

export type Auth = typeof auth;
