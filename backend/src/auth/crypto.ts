/**
 * Crypto-shredding primitives (LOCKED API — notes/auth-build-plan.md §1.2).
 *
 * AES-256-GCM with a RANDOM 12-byte IV per operation (never reused). Cipher blob
 * is `{ iv, authTag, ct }`, all base64 — field name is `ct` (NOT `ciphertext`);
 * the no-plaintext-PII tests assert presence of keys `iv`/`authTag`/`ct`.
 *
 * Pure functions, no DB. `node:crypto` ONLY → Node-safe (testcontainers
 * integration runs on Node; Bun-only globals would break it).
 *
 * Key hierarchy (notes/auth-architecture.md §2.1):
 *   KEK (env)  ── wraps ──▶ DEK (per user, random 32B, stored wrapped)
 *                              └─ encrypts ─▶ user PII + that user's account secrets
 *   EMAIL_INDEX_KEY (env) ── HMAC-SHA256 ──▶ deterministic email blind index
 */
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { AUTH_KEK, EMAIL_INDEX_KEY } from './keys.ts';

/** Ciphertext blob. All fields base64. `ct` is the ciphertext (NOT `ciphertext`). */
export type Cipher = { iv: string; authTag: string; ct: string };

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard nonce length; random per op, never reused.
const KEY_BYTES = 32; // aes-256 requires a 32-byte key.

/** Defense-in-depth: reject a wrong-length key before it reaches the cipher. */
const assertKey = (key: Buffer): void => {
  if (key.length !== KEY_BYTES)
    throw new Error(`crypto: key must be ${KEY_BYTES} bytes (got ${key.length}).`);
};

/** Encrypt raw bytes under a 32-byte key → `{iv, authTag, ct}` base64. */
const encryptRaw = (key: Buffer, plaintext: Buffer): Cipher => {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ct: ct.toString('base64'),
  };
};

/** Decrypt a `{iv, authTag, ct}` blob under a 32-byte key. Throws on tamper/wrong key. */
const decryptRaw = (key: Buffer, c: Cipher): Buffer => {
  assertKey(key);
  const iv = Buffer.from(c.iv, 'base64');
  const authTag = Buffer.from(c.authTag, 'base64');
  const ct = Buffer.from(c.ct, 'base64');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  // .final() throws if the GCM auth tag does not verify (tamper / wrong key).
  return Buffer.concat([decipher.update(ct), decipher.final()]);
};

// --- DEK lifecycle (KEK from env) ---

/** Generate a fresh per-user data-encryption key (32 random bytes). */
export const generateDek = (): Buffer => randomBytes(32);

/** Wrap a DEK under the master KEK for at-rest storage in the keystore. */
export const wrapDek = (dek: Buffer): Cipher => encryptRaw(AUTH_KEK, dek);

/** Unwrap a stored DEK with the KEK. Throws on bad authTag / wrong KEK. */
export const unwrapDek = (wrapped: Cipher): Buffer =>
  decryptRaw(AUTH_KEK, wrapped);

// --- Field encryption (under a DEK) ---

/** Encrypt a UTF-8 string under a DEK. */
export const encrypt = (dek: Buffer, plaintext: string): Cipher =>
  encryptRaw(dek, Buffer.from(plaintext, 'utf8'));

/** Decrypt a cipher blob under a DEK → UTF-8 string. Throws on tamper / wrong key. */
export const decrypt = (dek: Buffer, c: Cipher): string =>
  decryptRaw(dek, c).toString('utf8');

/** JSON-encode then encrypt a value under a DEK. */
export const encryptJson = <T>(dek: Buffer, v: T): Cipher =>
  encrypt(dek, JSON.stringify(v));

/** Decrypt then JSON-parse under a DEK. Throws on tamper / wrong key / bad JSON. */
export const decryptJson = <T>(dek: Buffer, c: Cipher): T =>
  JSON.parse(decrypt(dek, c)) as T;

// --- Blind index (deterministic, non-reversible) ---

/** Canonicalize an email for the lookup hash: trim + lowercase. */
export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

/**
 * Deterministic, non-reversible email lookup hash:
 * hex HMAC-SHA256(EMAIL_INDEX_KEY, normalizeEmail(email)).
 * Safe to persist (event data + index table) — the one derived value from
 * email allowed at rest.
 */
export const emailBlindIndex = (email: string): string =>
  createHmac('sha256', EMAIL_INDEX_KEY)
    .update(normalizeEmail(email))
    .digest('hex');
