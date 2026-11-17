import { randomBytes } from 'node:crypto';
import { decryptSecret, encryptSecret, generateOpaqueToken, safeEqual, sha256Hex } from './crypto';
import { base32Decode, base32Encode, hotp, otpauthUrl, totp, verifyTotp } from './totp';

// RFC 6238 Appendix B (SHA-1 seed "12345678901234567890"), truncated to 6 digits.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'));
const RFC_VECTORS: Array<[number, string]> = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
];

describe('TOTP', () => {
  it.each(RFC_VECTORS)('matches RFC 6238 vector at T=%i', (seconds, expected) => {
    expect(totp(RFC_SECRET, seconds * 1000)).toBe(expected);
  });

  it('matches RFC 4226 HOTP vectors', () => {
    const secret = Buffer.from('12345678901234567890', 'ascii');
    expect(hotp(secret, 0)).toBe('755224');
    expect(hotp(secret, 9)).toBe('520489');
  });

  it('round-trips base32', () => {
    const bytes = randomBytes(20);
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
    expect(() => base32Decode('!!!')).toThrow();
  });

  it('accepts codes within the window and rejects replays', () => {
    const now = 1_700_000_000_000;
    const code = totp(RFC_SECRET, now - 30_000);
    const step = verifyTotp(RFC_SECRET, code, { nowMs: now });
    expect(step).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, code, { nowMs: now, lastUsedStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET, totp(RFC_SECRET, now - 120_000), { nowMs: now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, 'abcdef', { nowMs: now })).toBeNull();
  });

  it('builds an otpauth URL', () => {
    const url = otpauthUrl({ secret: 'ABC', accountName: 'ada@example.com' });
    expect(url).toMatch(/^otpauth:\/\/totp\/MusicVerse%3Aada%40example\.com\?/);
    expect(url).toContain('secret=ABC');
  });
});

describe('crypto helpers', () => {
  const key = randomBytes(32);

  it('encrypts and decrypts with authentication', () => {
    const enc = encryptSecret('top secret', key);
    expect(enc.startsWith('v1:')).toBe(true);
    expect(decryptSecret(enc, key)).toBe('top secret');
    expect(() => decryptSecret(enc, randomBytes(32))).toThrow();
    // Layout: iv (12) | tag (16) | ciphertext. Flip a bit in the ciphertext and in the tag.
    const flip = (index: number) => {
      const raw = Buffer.from(enc.slice(3), 'base64');
      raw[index] = raw[index]! ^ 1;
      return `v1:${raw.toString('base64')}`;
    };
    const length = Buffer.from(enc.slice(3), 'base64').length;
    expect(length).toBe(12 + 16 + 'top secret'.length);
    expect(() => decryptSecret(flip(length - 1), key)).toThrow();
    expect(() => decryptSecret(flip(12), key)).toThrow();
  });

  it('generates unique url-safe tokens and stable hashes', () => {
    const a = generateOpaqueToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(generateOpaqueToken());
    expect(sha256Hex('x')).toHaveLength(64);
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });
});
