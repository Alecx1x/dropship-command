import { prisma } from "../db";
import { createFulfillmentTaskForOrder } from "../fulfillment/handoff";
import { upsertParsedOrder } from "./upsert";
import { parseWebhookOrder } from "./webhook-order";

/**
 * Ingest a single order from an orders/create | orders/updated webhook (2.3):
 * find the store by domain, parse the payload, resolve referenced products, and
 * upsert. Returns ingested:false if the shop isn't one we manage.
 */
export async function ingestWebhookOrder(
  shopDomain: string,
  payload: unknown,
): Promise<{ ingested: boolean }> {
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) return { ingested: false };

  const order = parseWebhookOrder(payload);

  const shopifyProductIds = order.lineItems
    .map((li) => li.shopifyProductId)
    .filter((x): x is string => x !== null);

  const products = shopifyProductIds.length
    ? await prisma.product.findMany({
        where: { storeId: store.id, shopifyProductId: { in: shopifyProductIds } },
        select: { id: true, shopifyProductId: true, costCents: true, shipCostCents: true },
      })
    : [];
  const productByShopifyId = new Map(
    products.map((p) => [p.shopifyProductId, p]),
  );

  await prisma.$transaction((tx) =>
    upsertParsedOrder(tx, store.id, order, productByShopifyId),
  );

  // Fulfillment handoff (2.6): create a task for the order if it needs one.
  const saved = await prisma.order.findUnique({
    where: {
      storeId_shopifyOrderId: {
        storeId: store.id,
        shopifyOrderId: order.shopifyOrderId,
      },
    },
    select: { id: true },
  });
  if (saved) await createFulfillmentTaskForOrder(saved.id);

  return { ingested: true };
}
