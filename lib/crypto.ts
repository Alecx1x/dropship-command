import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * Authenticated symmetric encryption for secrets at rest — Shopify access
 * tokens and supplier API keys (CLAUDE.md rule 2). Uses AES-256-GCM, which
 * provides both confidentiality and integrity: any tampering with the stored
 * ciphertext makes decryption throw rather than return corrupted plaintext.
 *
 * The 32-byte key comes from ENCRYPTION_KEY (64 hex chars) in the environment
 * and is never stored alongside the data. node:crypto is server-only, so this
 * module must never be imported into client or Edge code.
 *
 * Wire format (all base64), dot-separated so it stores in a single String
 * column: `iv.authTag.ciphertext`. A fresh random IV is generated per call, so
 * encrypting the same plaintext twice yields different ciphertexts.
 */

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // 96-bit nonce, the GCM-recommended size
const AUTH_TAG_BYTES = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("ENCRYPTION_KEY is not set.");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_BYTES} bytes (${KEY_BYTES * 2} hex chars); ` +
        `decoded ${key.length} bytes. Generate one with: ` +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }
  return key;
}

/** Encrypt a UTF-8 string. Returns `iv.authTag.ciphertext`, each base64. */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/**
 * Decrypt a payload produced by {@link encrypt}. Throws if the payload is
 * malformed, the key is wrong, or the ciphertext/tag has been tampered with
 * (GCM authentication failure).
 */
export function decrypt(payload: string): string {
  const key = getKey();
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed ciphertext payload: expected iv.authTag.ciphertext.");
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ciphertext = Buffer.from(parts[2], "base64");

  if (iv.length !== IV_BYTES) {
    throw new Error("Malformed ciphertext payload: invalid IV length.");
  }
  if (authTag.length !== AUTH_TAG_BYTES) {
    throw new Error("Malformed ciphertext payload: invalid auth tag length.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  // decipher.final() throws if authentication fails (wrong key or tampering).
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8",
  );
}
