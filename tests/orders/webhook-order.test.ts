import { describe, it, expect } from "vitest";

import { parseWebhookOrder } from "../../lib/orders/webhook-order";

// A trimmed but realistic orders/create webhook payload (REST shape).
const payload = {
  // Real Shopify webhooks include admin_graphql_api_id (a gid STRING). The
  // numeric id below is intentionally past 2^53 to prove we don't read it.
  id: 820982911946154508,
  admin_graphql_api_id: "gid://shopify/Order/820982911946154508",
  name: "#1001",
  order_number: 1001,
  created_at: "2026-06-09T14:22:00-04:00",
  financial_status: "paid",
  fulfillment_status: null,
  email: "jane@example.com",
  currency: "USD",
  total_price: "59.98",
  total_tax: "4.20",
  total_shipping_price_set: { shop_money: { amount: "5.00" } },
  line_items: [
    {
      id: 11,
      admin_graphql_api_id: "gid://shopify/LineItem/11",
      product_id: 501,
      quantity: 2,
      price: "24.99",
    },
    {
      id: 12,
      admin_graphql_api_id: "gid://shopify/LineItem/12",
      product_id: null,
      quantity: 1,
      price: "9.99",
    },
  ],
};

describe("parseWebhookOrder", () => {
  it("maps the REST order shape to ParsedOrder with money in cents", () => {
    const o = parseWebhookOrder(payload);
    expect(o.shopifyOrderId).toBe("820982911946154508");
    expect(o.orderNumber).toBe("#1001");
    expect(o.financialStatus).toBe("paid");
    expect(o.fulfillmentStatus).toBeNull();
    expect(o.customerEmail).toBe("jane@example.com");
    expect(o.revenueCents).toBe(5998);
    expect(o.taxCents).toBe(420);
    expect(o.shippingChargedCents).toBe(500);
    expect(o.currency).toBe("USD");
  });

  it("maps line items, ids to strings, and null product_id", () => {
    const o = parseWebhookOrder(payload);
    expect(o.lineItems).toHaveLength(2);
    expect(o.lineItems[0]).toMatchObject({
      shopifyLineItemId: "11",
      shopifyProductId: "501",
      quantity: 2,
      priceCents: 2499,
    });
    expect(o.lineItems[1].shopifyProductId).toBeNull();
  });

  it("falls back to customer.email and derives an order number", () => {
    const o = parseWebhookOrder({
      ...payload,
      name: null,
      order_number: 1234,
      email: null,
      customer: { email: "fallback@example.com" },
    });
    expect(o.orderNumber).toBe("#1234");
    expect(o.customerEmail).toBe("fallback@example.com");
  });

  it("defaults missing money and status fields", () => {
    const o = parseWebhookOrder({
      id: 5,
      created_at: "2026-06-01T00:00:00Z",
      line_items: [],
    });
    expect(o.revenueCents).toBe(0);
    expect(o.taxCents).toBe(0);
    expect(o.financialStatus).toBe("UNKNOWN");
    expect(o.currency).toBe("USD");
    expect(o.lineItems).toEqual([]);
  });
});
