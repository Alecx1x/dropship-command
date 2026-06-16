import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Shopify webhook's HMAC signature (SPEC 2.1).
 *
 * Shopify signs each webhook with HMAC-SHA256 over the RAW request body using
 * the app's webhook signing secret, base64-encoded in the X-Shopify-Hmac-Sha256
 * header. We must hash the exact bytes received (never the re-serialized JSON),
 * and compare in constant time.
 */
export function verifyShopifyHmac(
  rawBody: string,
  hmacHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!hmacHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(hmacHeader, "base64");
  } catch {
    return false;
  }

  // timingSafeEqual throws on length mismatch — guard first.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
