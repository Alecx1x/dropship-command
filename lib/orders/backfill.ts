import { decrypt } from "../crypto";
import { prisma } from "../db";
import { fetchOrdersViaBulk } from "../shopify/bulk";
import { ShopifyClient } from "../shopify/client";
import { upsertParsedOrder } from "./upsert";

/**
 * Backfill the last 90 days of a store's orders via Shopify bulk operations,
 * upserting Order + OrderItem rows and recording a SyncLog (SPEC 1.4).
 *
 * Observability (CLAUDE.md rule 6): a SyncLog row is opened immediately and
 * closed as ok/failed with itemsTouched or errorText, so every run is visible
 * even when it fails. Upserts are keyed on (storeId, shopifyOrderId) so re-runs
 * are idempotent.
 */
export async function backfillStoreOrders(
  storeId: string,
): Promise<{ ordersUpserted: number }> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error(`Store ${storeId} not found.`);

  const sync = await prisma.syncLog.create({
    data: { storeId, kind: "ORDERS", ok: false },
  });

  try {
    const accessToken = decrypt(store.accessTokenEnc);
    const client = new ShopifyClient({ shopDomain: store.shopDomain, accessToken });

    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceDate = since.toISOString().slice(0, 10); // YYYY-MM-DD

    const orders = await fetchOrdersViaBulk(client, sinceDate);

    // Resolve line-item products to local Product rows where they've been
    // imported (product import is 1.5; until then productId stays null).
    const products = await prisma.product.findMany({
      where: { storeId },
      select: { id: true, shopifyProductId: true, costCents: true, shipCostCents: true },
    });
    const productByShopifyId = new Map(
      products.map((p) => [p.shopifyProductId, p]),
    );

    let ordersUpserted = 0;
    for (const o of orders) {
      await prisma.$transaction((tx) =>
        upsertParsedOrder(tx, storeId, o, productByShopifyId),
      );
      ordersUpserted += 1;
    }

    await prisma.syncLog.update({
      where: { id: sync.id },
      data: { ok: true, finishedAt: new Date(), itemsTouched: ordersUpserted },
    });
    return { ordersUpserted };
  } catch (err) {
    await prisma.syncLog.update({
      where: { id: sync.id },
      data: {
        ok: false,
        finishedAt: new Date(),
        errorText: (err as Error)?.message?.slice(0, 1000) ?? "Unknown error",
      },
    });
    throw err;
  }
}
