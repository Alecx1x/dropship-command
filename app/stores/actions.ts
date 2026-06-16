"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { verifyShopifyCredentials } from "@/lib/shopify/verify";
import {
  enqueueOrderBackfill,
  enqueueProductImport,
  enqueueWebhookRegistration,
} from "@/workers/queues";

const schema = z.object({
  name: z.string().trim().min(1, "Store name is required."),
  shopDomain: z.string().trim().min(1, "Store domain is required."),
  accessToken: z.string().trim().min(1, "Admin API access token is required."),
});

export type RegisterState = { error: string } | undefined;

/** Strip protocol/path and lowercase, leaving just the host. */
function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

/**
 * Register (or reconnect) a Shopify store: validate input, verify the token
 * against Shopify live, then encrypt the token and upsert the Store. The token
 * is only ever persisted as AES-256-GCM ciphertext (CLAUDE.md rule 2).
 */
export async function registerStore(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    shopDomain: formData.get("shopDomain"),
    accessToken: formData.get("accessToken"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, accessToken } = parsed.data;
  const shopDomain = normalizeDomain(parsed.data.shopDomain);

  if (!shopDomain.endsWith(".myshopify.com")) {
    return { error: "Domain must be your store's *.myshopify.com address." };
  }

  // Live credential check before we save anything (SPEC 1.2).
  const result = await verifyShopifyCredentials(shopDomain, accessToken);
  if (!result.ok) {
    return { error: result.error };
  }

  const saved = await prisma.store.upsert({
    where: { shopDomain },
    create: {
      name,
      platform: "SHOPIFY",
      shopDomain,
      accessTokenEnc: encrypt(accessToken),
      status: "ACTIVE",
      currency: result.shop.currencyCode,
    },
    update: {
      name,
      accessTokenEnc: encrypt(accessToken),
      currency: result.shop.currencyCode,
      status: "ACTIVE",
    },
  });

  // Register webhook subscriptions in the background (SPEC 2.2). Don't fail the
  // connect if the queue is briefly unreachable — the nightly reverify covers it.
  try {
    await enqueueWebhookRegistration(saved.id);
  } catch (err) {
    console.error("Failed to enqueue webhook registration:", err);
  }

  revalidatePath("/stores");
  redirect("/stores");
}

/**
 * Enqueue a 90-day order backfill for a store (SPEC 1.4). The actual work runs
 * in the worker process (`npm run worker`); this just adds the job.
 */
export async function syncStoreOrders(formData: FormData): Promise<void> {
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) return;
  await enqueueOrderBackfill(storeId);
  revalidatePath("/stores");
}

/** Enqueue a full product import for a store (SPEC 1.5). */
export async function importStoreProductsAction(
  formData: FormData,
): Promise<void> {
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) return;
  await enqueueProductImport(storeId);
  revalidatePath("/stores");
}

const cogsSchema = z.object({
  productId: z.string().min(1),
  storeId: z.string().min(1),
  // Dollar amounts from the form, converted to integer cents on save.
  costDollars: z.coerce.number().min(0),
  shipDollars: z.coerce.number().min(0),
});

/**
 * Manually set a product's COGS (unit cost + supplier shipping), in cents.
 * Scoped by storeId for tenant isolation (CLAUDE.md rule 1).
 */
export async function updateProductCogs(formData: FormData): Promise<void> {
  const parsed = cogsSchema.safeParse({
    productId: formData.get("productId"),
    storeId: formData.get("storeId"),
    costDollars: formData.get("costDollars"),
    shipDollars: formData.get("shipDollars"),
  });
  if (!parsed.success) return;

  const { productId, storeId, costDollars, shipDollars } = parsed.data;
  await prisma.product.updateMany({
    where: { id: productId, storeId },
    data: {
      costCents: Math.round(costDollars * 100),
      shipCostCents: Math.round(shipDollars * 100),
    },
  });

  revalidatePath(`/stores/${storeId}/products`);
}
