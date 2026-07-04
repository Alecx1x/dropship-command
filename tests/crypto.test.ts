import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { encrypt, decrypt } from "../lib/crypto";

// Deterministic 32-byte key (64 hex chars) for tests.
const TEST_KEY =
  "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff";
const OTHER_KEY =
  "ffeeddccbbaa00998877665544332211ffeeddccbbaa00998877665544332211";

const originalKey = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterEach(() => {
  process.env.ENCRYPTION_KEY = originalKey;
});

describe("crypto (AES-256-GCM)", () => {
  it("round-trips a secret", () => {
    const secret = "dummy-shopify-token-for-round-trip-test";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("round-trips empty and unicode strings", () => {
    expect(decrypt(encrypt(""))).toBe("");
    const unicode = "🔐 café — 日本語 — naïve";
    expect(decrypt(encrypt(unicode))).toBe(unicode);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encrypt("same-secret");
    const b = encrypt("same-secret");
    expect(a).not.toBe(b);
    // ...but both decrypt back to the same plaintext.
    expect(decrypt(a)).toBe("same-secret");
    expect(decrypt(b)).toBe("same-secret");
  });

  it("emits the iv.authTag.ciphertext wire format", () => {
    const parts = encrypt("x").split(".");
    expect(parts).toHaveLength(3);
    // 12-byte IV -> 16 base64 chars; 16-byte tag -> 24 (padded) base64 chars.
    expect(Buffer.from(parts[0], "base64")).toHaveLength(12);
    expect(Buffer.from(parts[1], "base64")).toHaveLength(16);
  });

  it("fails to decrypt with the wrong key (authentication failure)", () => {
    const payload = encrypt("top-secret");
    process.env.ENCRYPTION_KEY = OTHER_KEY;
    expect(() => decrypt(payload)).toThrow();
  });

  it("fails to decrypt tampered ciphertext", () => {
    const [iv, tag, ct] = encrypt("top-secret").split(".");
    // Flip the ciphertext while keeping a valid base64 shape.
    const tamperedCt = Buffer.from(ct, "base64");
    tamperedCt[0] ^= 0xff;
    const tampered = [iv, tag, tamperedCt.toString("base64")].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("rejects malformed payloads", () => {
    expect(() => decrypt("")).toThrow();
    expect(() => decrypt("only.two")).toThrow();
    expect(() => decrypt("aaa.bbb.ccc.ddd")).toThrow();
  });

  it("throws a clear error when ENCRYPTION_KEY is missing or wrong length", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY is not set/);

    process.env.ENCRYPTION_KEY = "abcd"; // too short
    expect(() => encrypt("x")).toThrow(/must be 32 bytes/);
  });
});
