import { describe, it, expect } from "vitest";

import { parseRefundWebhook } from "../../lib/orders/refund-parse";

describe("parseRefundWebhook", () => {
  it("extracts a big-int order_id losslessly and sums refund transactions", () => {
    // Raw string literal (NOT JSON.stringify of a number, which would already
    // corrupt the >2^53 order_id) — this is what the webhook body actually is.
    const raw =
      '{"id":999,"order_id":820982911946154508,"transactions":[{"kind":"refund","amount":"12.50"},{"kind":"refund","amount":"5.00"}]}';
    const { shopifyOrderId, refundCents } = parseRefundWebhook(raw);
    expect(shopifyOrderId).toBe("820982911946154508");
    expect(refundCents).toBe(1750);
  });

  it("falls back to refund_line_items subtotals when no transactions", () => {
    const raw = JSON.stringify({
      order_id: 12345,
      refund_line_items: [{ subtotal: "9.99" }, { subtotal: "0.01" }],
    });
    const { shopifyOrderId, refundCents } = parseRefundWebhook(raw);
    expect(shopifyOrderId).toBe("12345");
    expect(refundCents).toBe(1000);
  });

  it("returns null order id and zero when unparseable", () => {
    const { shopifyOrderId, refundCents } = parseRefundWebhook("not json");
    expect(shopifyOrderId).toBeNull();
    expect(refundCents).toBe(0);
  });
});
