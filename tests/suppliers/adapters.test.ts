import { describe, it, expect } from "vitest";

import { aliexpressSearchUrl } from "../../lib/suppliers/adapter";
import { autodsAdapter } from "../../lib/suppliers/autods";
import { manualAdapter } from "../../lib/suppliers/manual";
import { getAdapter } from "../../lib/suppliers/registry";

describe("supplier adapters", () => {
  it("builds an encoded AliExpress search link", () => {
    expect(aliexpressSearchUrl("Mini Blender")).toBe(
      "https://www.aliexpress.com/wholesale?SearchText=Mini%20Blender",
    );
  });

  it("manual adapter returns MANUAL_REQUIRED with a supplier link", async () => {
    const result = await manualAdapter.placeOrder({
      orderNumber: "#1001",
      customerEmail: "a@b.com",
      lineItems: [{ title: "Pet Roller", quantity: 1, shopifyProductId: "1" }],
    });
    expect(result.status).toBe("MANUAL_REQUIRED");
    expect(result.manualUrl).toContain("SearchText=Pet%20Roller");
  });

  it("manual adapter handles an order with no line items", async () => {
    const result = await manualAdapter.placeOrder({
      orderNumber: "#1002",
      customerEmail: null,
      lineItems: [],
    });
    expect(result.status).toBe("MANUAL_REQUIRED");
    expect(result.manualUrl).toBeUndefined();
  });

  it("registry maps types to adapters, falling back to manual", () => {
    expect(getAdapter("AUTODS")).toBe(autodsAdapter);
    expect(getAdapter("MANUAL")).toBe(manualAdapter);
    expect(getAdapter("SPOCKET")).toBe(manualAdapter);
    expect(getAdapter("CJ")).toBe(manualAdapter);
  });
});
