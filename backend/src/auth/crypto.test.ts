import { describe, expect, test, beforeAll } from 'bun:test';
import { randomBytes } from 'node:crypto';

/**
 * Unit tests for the crypto-shred primitives. `crypto.ts` imports `keys.ts`,
 * which reads AUTH_KEK / EMAIL_INDEX_KEY / BETTER_AUTH_SECRET at MODULE LOAD and
 * throws if absent. So we set fixed test keys into the env BEFORE importing the
 * module (dynamic import in beforeAll, after env is populated).
 *
 * Pure `node:crypto` → these run under `bun test` regardless of any DB.
 */

// Fixed, deterministic test keys (base64, 32 bytes decoded).
const TEST_KEK = randomBytes(32).toString('base64');
const TEST_INDEX_KEY = randomBytes(32).toString('base64');

// Loaded lazily after env is set.
let crypto: typeof import('./crypto.ts');

beforeAll(async () => {
  process.env.AUTH_KEK = TEST_KEK;
  process.env.EMAIL_INDEX_KEY = TEST_INDEX_KEY;
  process.env.BETTER_AUTH_SECRET = 'test-secret-at-least-32-characters-long-x';
  crypto = await import('./crypto.ts');
});

describe('field encryption (encrypt/decrypt)', () => {
  test('round-trips a plaintext string under a DEK', () => {
    const dek = crypto.generateDek();
    const c = crypto.encrypt(dek, 'alice@example.com');
    expect(crypto.decrypt(dek, c)).toBe('alice@example.com');
  });

  test('cipher blob has exactly keys iv/authTag/ct (base64), no plaintext', () => {
    const dek = crypto.generateDek();
    const c = crypto.encrypt(dek, 'super-secret-name');
    expect(Object.keys(c).sort()).toEqual(['authTag', 'ct', 'iv']);
    // No `ciphertext` field — locked to `ct`.
    expect(c).not.toHaveProperty('ciphertext');
    // Plaintext must not leak into any blob field.
    const blob = JSON.stringify(c);
    expect(blob).not.toContain('super-secret-name');
    // Fields are valid base64.
    for (const v of [c.iv, c.authTag, c.ct]) {
      expect(Buffer.from(v, 'base64').toString('base64')).toBe(v);
    }
  });

  test('IV is unique across calls (never reused for the same plaintext)', () => {
    const dek = crypto.generateDek();
    const ivs = new Set<string>();
    const cts = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const c = crypto.encrypt(dek, 'identical-plaintext');
      ivs.add(c.iv);
      cts.add(c.ct);
    }
    // Random 12-byte IV per op → all distinct.
    expect(ivs.size).toBe(100);
    // Distinct IV → distinct ciphertext even for identical plaintext.
    expect(cts.size).toBe(100);
  });

  test('tampered ciphertext throws on decrypt', () => {
    const dek = crypto.generateDek();
    const c = crypto.encrypt(dek, 'do-not-tamper');
    // Flip a byte in the ciphertext.
    const raw = Buffer.from(c.ct, 'base64');
    raw[0] = raw[0]! ^ 0xff;
    const tampered = { ...c, ct: raw.toString('base64') };
    expect(() => crypto.decrypt(dek, tampered)).toThrow();
  });

  test('tampered authTag throws on decrypt', () => {
    const dek = crypto.generateDek();
    const c = crypto.encrypt(dek, 'auth-tag-guard');
    const tag = Buffer.from(c.authTag, 'base64');
    tag[0] = tag[0]! ^ 0xff;
    expect(() => crypto.decrypt(dek, { ...c, authTag: tag.toString('base64') })).toThrow();
  });

  test('wrong key throws on decrypt', () => {
    const dek = crypto.generateDek();
    const other = crypto.generateDek();
    const c = crypto.encrypt(dek, 'wrong-key-should-fail');
    expect(() => crypto.decrypt(other, c)).toThrow();
  });
});

describe('JSON field encryption (encryptJson/decryptJson)', () => {
  test('round-trips a structured value', () => {
    const dek = crypto.generateDek();
    const tokens = {
      accessToken: 'a',
      refreshToken: 'b',
      scope: 'openid email',
      n: 42,
    };
    const c = crypto.encryptJson(dek, tokens);
    expect(crypto.decryptJson<typeof tokens>(dek, c)).toEqual(tokens);
  });

  test('wrong key throws on decryptJson', () => {
    const dek = crypto.generateDek();
    const other = crypto.generateDek();
    const c = crypto.encryptJson(dek, { x: 1 });
    expect(() => crypto.decryptJson(other, c)).toThrow();
  });
});

describe('DEK wrap/unwrap (under KEK)', () => {
  test('wrap then unwrap recovers the same DEK bytes', () => {
    const dek = crypto.generateDek();
    expect(dek.length).toBe(32);
    const wrapped = crypto.wrapDek(dek);
    expect(Object.keys(wrapped).sort()).toEqual(['authTag', 'ct', 'iv']);
    const recovered = crypto.unwrapDek(wrapped);
    expect(recovered.equals(dek)).toBe(true);
  });

  test('a DEK encrypted under a wrapped-then-unwrapped key still decrypts', () => {
    const dek = crypto.generateDek();
    const c = crypto.encrypt(dek, 'pii-payload');
    const recovered = crypto.unwrapDek(crypto.wrapDek(dek));
    expect(crypto.decrypt(recovered, c)).toBe('pii-payload');
  });

  test('tampered wrapped DEK throws on unwrap', () => {
    const dek = crypto.generateDek();
    const wrapped = crypto.wrapDek(dek);
    const raw = Buffer.from(wrapped.ct, 'base64');
    raw[0] = raw[0]! ^ 0xff;
    expect(() => crypto.unwrapDek({ ...wrapped, ct: raw.toString('base64') })).toThrow();
  });
});

describe('email blind index', () => {
  test('is deterministic for the same email', () => {
    expect(crypto.emailBlindIndex('user@example.com')).toBe(
      crypto.emailBlindIndex('user@example.com'),
    );
  });

  test('normalizes case + surrounding whitespace', () => {
    const canonical = crypto.emailBlindIndex('user@example.com');
    expect(crypto.emailBlindIndex('USER@EXAMPLE.COM')).toBe(canonical);
    expect(crypto.emailBlindIndex('  User@Example.Com  ')).toBe(canonical);
  });

  test('differs for different emails', () => {
    expect(crypto.emailBlindIndex('a@example.com')).not.toBe(
      crypto.emailBlindIndex('b@example.com'),
    );
  });

  test('is a hex SHA-256 digest (64 hex chars), non-reversible', () => {
    const idx = crypto.emailBlindIndex('user@example.com');
    expect(idx).toMatch(/^[0-9a-f]{64}$/);
    // Hash does not contain the plaintext.
    expect(idx).not.toContain('user');
  });

  test('normalizeEmail trims + lowercases', () => {
    expect(crypto.normalizeEmail('  Foo@BAR.com ')).toBe('foo@bar.com');
  });
});
