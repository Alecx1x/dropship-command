import type { Prisma } from "../generated/prisma/client";
import type { ParsedOrder } from "../shopify/bulk";

export interface ProductCostRef {
  id: string;
  costCents: number;
  shipCostCents: number;
}

/**
 * Upsert one parsed order + its line items, keyed on (storeId, shopifyOrderId).
 * Shared by the order backfill (1.4) and live webhook ingestion (2.3) so both
 * paths converge on identical rows. Run inside a transaction; line items are
 * rewritten so re-deliveries/updates don't duplicate.
 */
export async function upsertParsedOrder(
  tx: Prisma.TransactionClient,
  storeId: string,
  o: ParsedOrder,
  productByShopifyId: Map<string, ProductCostRef>,
): Promise<void> {
  const order = await tx.order.upsert({
    where: {
      storeId_shopifyOrderId: { storeId, shopifyOrderId: o.shopifyOrderId },
    },
    create: {
      storeId,
      shopifyOrderId: o.shopifyOrderId,
      orderNumber: o.orderNumber,
      placedAt: o.placedAt,
      financialStatus: o.financialStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      customerEmail: o.customerEmail,
      revenueCents: o.revenueCents,
      shippingChargedCents: o.shippingChargedCents,
      taxCents: o.taxCents,
      currency: o.currency,
    },
    update: {
      orderNumber: o.orderNumber,
      placedAt: o.placedAt,
      financialStatus: o.financialStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      customerEmail: o.customerEmail,
      revenueCents: o.revenueCents,
      shippingChargedCents: o.shippingChargedCents,
      taxCents: o.taxCents,
      currency: o.currency,
    },
  });

  await tx.orderItem.deleteMany({ where: { orderId: order.id } });
  for (const li of o.lineItems) {
    const product = li.shopifyProductId
      ? productByShopifyId.get(li.shopifyProductId)
      : undefined;
    await tx.orderItem.create({
      data: {
        orderId: order.id,
        productId: product?.id ?? null,
        qty: li.quantity,
        priceCents: li.priceCents,
        costCents: product ? product.costCents + product.shipCostCents : 0,
      },
    });
  }
}
