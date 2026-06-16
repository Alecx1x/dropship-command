import { prisma } from "../db";
import { parseRefundWebhook } from "./refund-parse";

/**
 * Apply a refund to its order (SPEC 3.4): increment the order's refundCents so
 * the P&L rollup reflects it. Endpoint + queue dedupe prevent double-application.
 */
export async function ingestRefund(
  shopDomain: string,
  rawPayload: string,
): Promise<{ applied: boolean }> {
  const store = await prisma.store.findUnique({
    where: { shopDomain },
    select: { id: true },
  });
  if (!store) return { applied: false };

  const { shopifyOrderId, refundCents } = parseRefundWebhook(rawPayload);
  if (!shopifyOrderId || refundCents <= 0) return { applied: false };

  const res = await prisma.order.updateMany({
    where: { storeId: store.id, shopifyOrderId },
    data: { refundCents: { increment: refundCents } },
  });
  return { applied: res.count > 0 };
}
