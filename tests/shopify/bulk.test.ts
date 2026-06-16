import { describe, it, expect } from "vitest";

import { gidToId, toCents, parseOrdersJsonl } from "../../lib/shopify/bulk";

describe("bulk helpers", () => {
  it("extracts the numeric id from a gid", () => {
    expect(gidToId("gid://shopify/Order/12345")).toBe("12345");
    expect(gidToId("gid://shopify/LineItem/999")).toBe("999");
  });

  it("converts money strings to integer cents", () => {
    expect(toCents("29.99")).toBe(2999);
    expect(toCents("0.10")).toBe(10);
    expect(toCents("100")).toBe(10000);
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(toCents("not-a-number")).toBe(0);
  });
});

describe("parseOrdersJsonl", () => {
  // Two orders; order 1 has two line items, order 2 has one with no product.
  const jsonl = [
    JSON.stringify({
      id: "gid://shopify/Order/1",
      name: "#1001",
      createdAt: "2026-05-01T10:00:00Z",
      displayFinancialStatus: "PAID",
      displayFulfillmentStatus: "FULFILLED",
      email: "a@example.com",
      currentTotalPriceSet: { shopMoney: { amount: "59.98", currencyCode: "USD" } },
      totalShippingPriceSet: { shopMoney: { amount: "0.00" } },
      totalTaxSet: { shopMoney: { amount: "4.20" } },
    }),
    JSON.stringify({
      id: "gid://shopify/LineItem/11",
      quantity: 2,
      originalUnitPriceSet: { shopMoney: { amount: "29.99" } },
      product: { id: "gid://shopify/Product/501" },
      __parentId: "gid://shopify/Order/1",
    }),
    JSON.stringify({
      id: "gid://shopify/LineItem/12",
      quantity: 1,
      originalUnitPriceSet: { shopMoney: { amount: "19.99" } },
      product: { id: "gid://shopify/Product/502" },
      __parentId: "gid://shopify/Order/1",
    }),
    JSON.stringify({
      id: "gid://shopify/Order/2",
      name: "#1002",
      createdAt: "2026-05-02T12:00:00Z",
      displayFinancialStatus: "PENDING",
      displayFulfillmentStatus: null,
      email: null,
      currentTotalPriceSet: { shopMoney: { amount: "24.99", currencyCode: "USD" } },
      totalShippingPriceSet: { shopMoney: { amount: "0.00" } },
      totalTaxSet: { shopMoney: { amount: "0.00" } },
    }),
    JSON.stringify({
      id: "gid://shopify/LineItem/21",
      quantity: 1,
      originalUnitPriceSet: { shopMoney: { amount: "24.99" } },
      product: null,
      __parentId: "gid://shopify/Order/2",
    }),
    "", // trailing blank line, as Shopify JSONL has
  ].join("\n");

  it("assembles orders with their line items", () => {
    const orders = parseOrdersJsonl(jsonl);
    expect(orders).toHaveLength(2);

    const o1 = orders.find((o) => o.shopifyOrderId === "1")!;
    expect(o1.orderNumber).toBe("#1001");
    expect(o1.financialStatus).toBe("PAID");
    expect(o1.fulfillmentStatus).toBe("FULFILLED");
    expect(o1.customerEmail).toBe("a@example.com");
    expect(o1.revenueCents).toBe(5998);
    expect(o1.taxCents).toBe(420);
    expect(o1.currency).toBe("USD");
    expect(o1.lineItems).toHaveLength(2);
    expect(o1.lineItems[0]).toMatchObject({
      shopifyLineItemId: "11",
      shopifyProductId: "501",
      quantity: 2,
      priceCents: 2999,
    });
  });

  it("handles null fulfillment, null email, and missing product", () => {
    const orders = parseOrdersJsonl(jsonl);
    const o2 = orders.find((o) => o.shopifyOrderId === "2")!;
    expect(o2.fulfillmentStatus).toBeNull();
    expect(o2.customerEmail).toBeNull();
    expect(o2.lineItems).toHaveLength(1);
    expect(o2.lineItems[0].shopifyProductId).toBeNull();
  });

  it("returns an empty array for empty input", () => {
    expect(parseOrdersJsonl("")).toEqual([]);
    expect(parseOrdersJsonl("\n\n")).toEqual([]);
  });
});
