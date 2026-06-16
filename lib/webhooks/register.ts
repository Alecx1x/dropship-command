import { decrypt } from "../crypto";
import { prisma } from "../db";
import { ShopifyClient } from "../shopify/client";
import { ensureWebhooks, type EnsureResult } from "../shopify/webhooks-register";

/** Build the public callback URL Shopify should POST webhooks to. */
function callbackUrl(): string {
  const base = (
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}/api/webhooks/shopify`;
}

/**
 * Register (or re-verify) all required webhook subscriptions for a store
 * (SPEC 2.2). Called on store connect and by the nightly re-verify.
 */
export async function registerStoreWebhooks(
  storeId: string,
): Promise<EnsureResult> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error(`Store ${storeId} not found.`);

  const accessToken = decrypt(store.accessTokenEnc);
  const client = new ShopifyClient({ shopDomain: store.shopDomain, accessToken });

  return ensureWebhooks(client, callbackUrl());
}
