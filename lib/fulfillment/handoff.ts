import { prisma } from "../db";
import type { SupplierType } from "../suppliers/adapter";
import { getAdapter } from "../suppliers/registry";

/**
 * Create a fulfillment task for an order (SPEC 2.6) — the handoff triggered when
 * an order is ingested. Idempotent (one task per order) and skips orders already
 * fulfilled. The supplier type comes from the first supplier-linked product, or
 * MANUAL when none is linked.
 */
export async function createFulfillmentTaskForOrder(
  orderId: string,
): Promise<{ created: boolean }> {
  const existing = await prisma.fulfillmentTask.findUnique({
    where: { orderId },
    select: { id: true },
  });
  if (existing) return { created: false };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { include: { supplier: true } } } },
    },
  });
  if (!order) return { created: false };
  if (order.fulfillmentStatus === "fulfilled") return { created: false };

  const supplierType: SupplierType =
    (order.items
      .map((i) => i.product?.supplier?.type)
      .find((t): t is NonNullable<typeof t> => Boolean(t)) as
      | SupplierType
      | undefined) ?? "MANUAL";

  const adapter = getAdapter(supplierType);
  const result = await adapter.placeOrder({
    orderNumber: order.orderNumber,
    customerEmail: order.customerEmail,
    lineItems: order.items.map((i) => ({
      title: i.product?.title ?? "Unknown product",
      quantity: i.qty,
      shopifyProductId: i.product?.shopifyProductId ?? null,
    })),
  });

  await prisma.fulfillmentTask.create({
    data: {
      storeId: order.storeId,
      orderId: order.id,
      supplierType,
      status: result.status === "PLACED" ? "PLACED" : "PENDING",
      supplierUrl: result.manualUrl ?? null,
      externalOrderId: result.externalOrderId ?? null,
    },
  });

  return { created: true };
}
