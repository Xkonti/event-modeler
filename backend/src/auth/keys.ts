/**
 * Auth key loading + validation. Reads the three secrets from the environment
 * ONCE at module load and fails LOUD (throws) on anything missing/short — a
 * misconfigured crypto root must never silently degrade to a weak/empty key.
 *
 * - AUTH_KEK         : master key (base64, decodes to 32 bytes) wrapping each DEK.
 * - EMAIL_INDEX_KEY  : HMAC key (base64, decodes to 32 bytes) for the email blind index.
 * - BETTER_AUTH_SECRET: better-auth's own signing/cookie secret (>= 32 chars).
 *
 * `node:crypto` / pure env only → Node-safe (testcontainers integration runs on
 * Node).
 */

/** Decode a base64 env var into a Buffer of EXACTLY 32 bytes, or throw. */
const load32ByteKey = (name: string): Buffer => {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') {
    throw new Error(`Missing required env var ${name} (base64, 32 bytes).`);
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new Error(`Env var ${name} is not valid base64.`);
  }
  if (key.length !== 32) {
    throw new Error(
      `Env var ${name} must decode to exactly 32 bytes (got ${key.length}). ` +
        `Generate with: node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  return key;
};

/** Load a string secret with a minimum length, or throw. */
const loadStringSecret = (name: string, minLength: number): string => {
  const raw = process.env[name];
  if (!raw || raw.length < minLength) {
    throw new Error(
      `Missing or too-short env var ${name} (need >= ${minLength} chars).`,
    );
  }
  return raw;
};

/** Master key-encryption-key. Wraps every per-user DEK at rest. */
export const AUTH_KEK: Buffer = load32ByteKey('AUTH_KEK');

/** HMAC-SHA256 key for the deterministic, non-reversible email blind index. */
export const EMAIL_INDEX_KEY: Buffer = load32ByteKey('EMAIL_INDEX_KEY');

/** better-auth signing/cookie/CSRF secret (unrelated to the crypto-shred keys). */
export const BETTER_AUTH_SECRET: string = loadStringSecret(
  'BETTER_AUTH_SECRET',
  32,
);
