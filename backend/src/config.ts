/**
 * Runtime configuration, sourced from the environment.
 * Defaults match docker-compose.yml + .env.example for local dev.
 */
export const connectionString =
  process.env.POSTGRESQL_CONNECTION_STRING ??
  'postgresql://event_modeler:event_modeler@localhost:5432/event_modeler';

export const port = Number(process.env.PORT ?? 3000);

/** True in a production deployment (`NODE_ENV=production`). */
export const isProduction = process.env.NODE_ENV === 'production';

/**
 * better-auth browser-facing (proxied) origin. In dev the Vite proxy makes the
 * browser see `:5173`; better-auth must issue cookies for THAT origin
 * (notes/auth-build-plan.md §1). Backend still binds `:3000`.
 *
 * In production the session cookie's `Secure` attribute is derived from this
 * being https — fail LOUD if a prod deploy leaves it http (would ship session
 * tokens without `Secure`, sniffable on a plaintext hop). Same philosophy as
 * the key loaders in auth/keys.ts.
 */
export const betterAuthUrl =
  process.env.BETTER_AUTH_URL ?? 'http://localhost:5173';

if (isProduction && !betterAuthUrl.startsWith('https://')) {
  throw new Error(
    `BETTER_AUTH_URL must be https:// in production (got: ${betterAuthUrl}). ` +
      `An http origin yields session cookies without the Secure attribute.`,
  );
}

/** Comma-separated trusted origins for better-auth CSRF/origin checks. */
export const trustedOrigins = (
  process.env.AUTH_TRUSTED_ORIGINS ?? 'http://localhost:5173'
)
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);
