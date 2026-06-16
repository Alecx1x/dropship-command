import { describe, it, expect } from "vitest";

import { parseProductsJsonl } from "../../lib/shopify/products";

describe("parseProductsJsonl", () => {
  const jsonl = [
    // Product 1: two variants — representative is the lowest-priced one, which
    // also carries a Shopify unit cost.
    JSON.stringify({ id: "gid://shopify/Product/501", title: "Posture Corrector", status: "ACTIVE" }),
    JSON.stringify({
      id: "gid://shopify/ProductVariant/9001",
      price: "39.99",
      compareAtPrice: "59.99",
      inventoryItem: { unitCost: { amount: "6.00" } },
      __parentId: "gid://shopify/Product/501",
    }),
    JSON.stringify({
      id: "gid://shopify/ProductVariant/9002",
      price: "29.99",
      compareAtPrice: "49.99",
      inventoryItem: { unitCost: { amount: "4.80" } },
      __parentId: "gid://shopify/Product/501",
    }),
    // Product 2: one variant, no compareAt, no unit cost.
    JSON.stringify({ id: "gid://shopify/Product/502", title: "Galaxy Projector", status: "DRAFT" }),
    JSON.stringify({
      id: "gid://shopify/ProductVariant/9101",
      price: "24.99",
      compareAtPrice: null,
      inventoryItem: { unitCost: null },
      __parentId: "gid://shopify/Product/502",
    }),
    // Product 3: no variants at all.
    JSON.stringify({ id: "gid://shopify/Product/503", title: "Bare Product", status: "ACTIVE" }),
    "",
  ].join("\n");

  it("collapses variants to the lowest-priced representative", () => {
    const products = parseProductsJsonl(jsonl);
    const p1 = products.find((p) => p.shopifyProductId === "501")!;
    expect(p1.title).toBe("Posture Corrector");
    expect(p1.priceCents).toBe(2999); // the $29.99 variant, not $39.99
    expect(p1.compareAtCents).toBe(4999);
    expect(p1.costCents).toBe(480); // unit cost from the chosen variant
  });

  it("handles null compareAt and missing unit cost", () => {
    const products = parseProductsJsonl(jsonl);
    const p2 = products.find((p) => p.shopifyProductId === "502")!;
    expect(p2.status).toBe("DRAFT");
    expect(p2.priceCents).toBe(2499);
    expect(p2.compareAtCents).toBeNull();
    expect(p2.costCents).toBeNull();
  });

  it("handles a product with no variants", () => {
    const products = parseProductsJsonl(jsonl);
    const p3 = products.find((p) => p.shopifyProductId === "503")!;
    expect(p3.priceCents).toBe(0);
    expect(p3.compareAtCents).toBeNull();
    expect(p3.costCents).toBeNull();
  });

  it("returns empty for empty input", () => {
    expect(parseProductsJsonl("")).toEqual([]);
  });
});
