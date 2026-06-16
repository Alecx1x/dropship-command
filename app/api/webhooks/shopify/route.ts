import { verifyShopifyHmac } from "@/lib/shopify/webhook";
import { connection } from "@/workers/connection";
import { enqueueWebhook } from "@/workers/queues";

// Node runtime: uses node:crypto (HMAC) and ioredis. Must stay off the Edge.
export const runtime = "nodejs";
// Never cache; every webhook is unique.
export const dynamic = "force-dynamic";

const DEDUPE_TTL_SECONDS = 60 * 60 * 24; // 1 day

/**
 * Shopify webhook receiver (SPEC 2.1, CLAUDE.md rule 3): verify HMAC over the
 * raw body, dedupe by webhook id, enqueue, and return 200 in well under a
 * second. All real processing happens in the worker (lib/webhooks/handle.ts).
 *
 * This route is excluded from the auth proxy (see proxy.ts matcher) so Shopify
 * can reach it unauthenticated — the HMAC IS the authentication.
 */
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Must hash the RAW body bytes, so read text before any JSON parsing.
  const raw = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  if (!verifyShopifyHmac(raw, hmac, secret)) {
    return new Response("Invalid HMAC", { status: 401 });
  }

  const topic = req.headers.get("x-shopify-topic") ?? "";
  const shopDomain = req.headers.get("x-shopify-shop-domain") ?? "";
  const webhookId = req.headers.get("x-shopify-webhook-id") ?? "";

  // Dedupe: first delivery wins; Shopify retries (same webhook id) are acked.
  if (webhookId) {
    const set = await connection.set(
      `webhook:${webhookId}`,
      "1",
      "EX",
      DEDUPE_TTL_SECONDS,
      "NX",
    );
    if (set === null) {
      return new Response(null, { status: 200 }); // already seen
    }
  }

  await enqueueWebhook({ topic, shopDomain, webhookId, payload: raw });
  return new Response(null, { status: 200 });
}
