import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";

import { verifyShopifyHmac } from "../../lib/shopify/webhook";

const SECRET = "shpss_test_secret";

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

describe("verifyShopifyHmac", () => {
  const body = JSON.stringify({ id: 123, email: "a@example.com" });

  it("accepts a correctly signed body", () => {
    expect(verifyShopifyHmac(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    expect(verifyShopifyHmac(body, sign(body, "other-secret"), SECRET)).toBe(false);
  });

  it("rejects when the body was tampered with", () => {
    const header = sign(body);
    expect(verifyShopifyHmac(body + " ", header, SECRET)).toBe(false);
  });

  it("rejects a missing or empty signature header", () => {
    expect(verifyShopifyHmac(body, null, SECRET)).toBe(false);
    expect(verifyShopifyHmac(body, undefined, SECRET)).toBe(false);
    expect(verifyShopifyHmac(body, "", SECRET)).toBe(false);
  });

  it("rejects a malformed / wrong-length signature", () => {
    expect(verifyShopifyHmac(body, "not-valid-base64-hmac", SECRET)).toBe(false);
  });

  it("verifies unicode bodies byte-for-byte", () => {
    const unicodeBody = JSON.stringify({ note: "café 日本語 🚀" });
    expect(verifyShopifyHmac(unicodeBody, sign(unicodeBody), SECRET)).toBe(true);
  });
});
