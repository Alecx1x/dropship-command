import { toCents } from "../shopify/bulk";

/**
 * Parse a Shopify refunds/create webhook (SPEC 3.4) — PURE, no DB.
 *
 * The refund's `order_id` is a number that can exceed JS's safe-integer range,
 * so we extract it from the RAW payload string by regex (lossless) rather than
 * reading the JSON-parsed value. The refunded amount is summed from the refund
 * transactions (amounts are strings, safe to JSON-parse); refund_line_items is a
 * fallback when transactions are absent.
 */
export function parseRefundWebhook(rawPayload: string): {
  shopifyOrderId: string | null;
  refundCents: number;
} {
  const match = rawPayload.match(/"order_id"\s*:\s*"?(\d+)"?/);
  const shopifyOrderId = match ? match[1] : null;

  let refundCents = 0;
  try {
    const obj = JSON.parse(rawPayload) as Record<string, unknown>;

    const txns = Array.isArray(obj.transactions) ? obj.transactions : [];
    for (const t of txns) {
      const txn = t as { kind?: string; amount?: string };
      if ((txn.kind === "refund" || txn.kind === undefined) && txn.amount != null) {
        refundCents += toCents(txn.amount);
      }
    }

    if (refundCents === 0 && Array.isArray(obj.refund_line_items)) {
      for (const rli of obj.refund_line_items) {
        const item = rli as { subtotal?: string };
        if (item.subtotal != null) refundCents += toCents(item.subtotal);
      }
    }
  } catch {
    // Non-JSON / malformed: fall through with whatever we extracted.
  }

  return { shopifyOrderId, refundCents };
}
