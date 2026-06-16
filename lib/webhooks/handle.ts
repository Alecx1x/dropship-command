import { prisma } from "../db";
import { ingestWebhookOrder } from "../orders/ingest";
import { ingestRefund } from "../orders/refund";

/**
 * Route a verified Shopify webhook to its handler (SPEC 2.1+). The endpoint
 * already verified HMAC, deduped, and enqueued; this runs in the worker.
 *
 * Only app/uninstalled is implemented now (it's simple and important). The data
 * topics are acked as no-ops until their ingestion tasks land:
 *   - orders/create, orders/updated      → live order ingestion (2.3)
 *   - inventory_levels/update, products/update → guardrails / sync (2.4)
 */
export interface WebhookJob {
  topic: string;
  shopDomain: string;
  webhookId: string;
  payload: string;
}

export async function handleWebhook(job: WebhookJob): Promise<void> {
  switch (job.topic) {
    case "app/uninstalled": {
      // The store revoked access — archive it so syncs stop touching it.
      await prisma.store.updateMany({
        where: { shopDomain: job.shopDomain },
        data: { status: "ARCHIVED" },
      });
      return;
    }

    case "orders/create":
    case "orders/updated": {
      // Live order ingestion (2.3): upsert the order so it appears on the
      // dashboard within seconds.
      const payload = JSON.parse(job.payload);
      await ingestWebhookOrder(job.shopDomain, payload);
      return;
    }

    case "refunds/create": {
      // Refund tracking (3.4): add to the order's refundCents for P&L.
      await ingestRefund(job.shopDomain, job.payload);
      return;
    }

    case "products/update":
    case "inventory_levels/update":
      // TODO(2.4): price/stock guardrails. Ack for now.
      return;

    default:
      // Unknown topic — ack and move on.
      return;
  }
}
