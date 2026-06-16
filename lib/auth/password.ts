import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing for the single-owner credentials login (SPEC 0.3).
 *
 * Uses Node's built-in scrypt — a memory-hard KDF — so there is no native
 * `bcrypt` build step (important on Windows). The hash is stored as
 * `salt:derivedKey`, both hex, in the AUTH_USER_PASSWORD_HASH env var.
 *
 * scrypt is a Node-only API (node:crypto), so anything importing this file is
 * server-only and must never be pulled into Edge middleware (see auth.config.ts).
 */

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** Hash a plaintext password into a `salt:derivedKey` string for storage. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derived}`;
}

/**
 * Verify a plaintext password against a stored `salt:derivedKey` hash.
 * Comparison is constant-time to avoid leaking timing information.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, derivedHex] = stored.split(":");
  if (!salt || !derivedHex) return false;

  const expected = Buffer.from(derivedHex, "hex");
  const actual = scryptSync(password, salt, KEY_LENGTH);

  // timingSafeEqual throws if lengths differ, so guard first.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
