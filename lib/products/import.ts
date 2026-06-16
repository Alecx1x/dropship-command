import { decrypt } from "../crypto";
import { prisma } from "../db";
import { ShopifyClient } from "../shopify/client";
import { fetchProductsViaBulk } from "../shopify/products";

/**
 * Import all of a store's products + variants via Shopify bulk operations,
 * upserting Product rows and recording a SyncLog (SPEC 1.5).
 *
 * COGS preservation: on first import we seed costCents from Shopify's unit cost
 * when present (else 0). On re-import we DON'T touch costCents/shipCostCents, so
 * manually-entered COGS is never clobbered — only catalog fields (title, status,
 * price, compareAt) refresh.
 */
export async function importStoreProducts(
  storeId: string,
): Promise<{ productsUpserted: number }> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error(`Store ${storeId} not found.`);

  const sync = await prisma.syncLog.create({
    data: { storeId, kind: "PRODUCTS", ok: false },
  });

  try {
    const accessToken = decrypt(store.accessTokenEnc);
    const client = new ShopifyClient({ shopDomain: store.shopDomain, accessToken });

    const products = await fetchProductsViaBulk(client);

    let productsUpserted = 0;
    for (const p of products) {
      await prisma.product.upsert({
        where: {
          storeId_shopifyProductId: {
            storeId,
            shopifyProductId: p.shopifyProductId,
          },
        },
        create: {
          storeId,
          shopifyProductId: p.shopifyProductId,
          title: p.title,
          status: p.status,
          priceCents: p.priceCents,
          compareAtCents: p.compareAtCents,
          costCents: p.costCents ?? 0,
          shipCostCents: 0,
        },
        // Refresh catalog fields only; preserve manual COGS.
        update: {
          title: p.title,
          status: p.status,
          priceCents: p.priceCents,
          compareAtCents: p.compareAtCents,
        },
      });
      productsUpserted += 1;
    }

    await prisma.syncLog.update({
      where: { id: sync.id },
      data: { ok: true, finishedAt: new Date(), itemsTouched: productsUpserted },
    });
    return { productsUpserted };
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
