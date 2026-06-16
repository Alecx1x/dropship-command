import { Queue } from "bullmq";

import { connection } from "./connection";

/**
 * Queue definitions. Producers (Next server actions) import the enqueue helpers
 * here; the Worker process (workers/index.ts) consumes them.
 */

export const ORDERS_BACKFILL_QUEUE = "orders-backfill";
export const PRODUCTS_IMPORT_QUEUE = "products-import";
export const SHOPIFY_WEBHOOKS_QUEUE = "shopify-webhooks";
export const WEBHOOKS_REGISTER_QUEUE = "webhooks-register";
export const GUARDRAILS_QUEUE = "guardrails";
export const METRICS_ROLLUP_QUEUE = "metrics-rollup";
export const PORTFOLIO_REVIEW_QUEUE = "portfolio-review";
export const ANOMALY_QUEUE = "anomaly-detection";

export interface StoreJobData {
  storeId: string;
}
/** @deprecated alias kept for existing imports. */
export type OrderBackfillJobData = StoreJobData;

export interface WebhookJobData {
  topic: string;
  shopDomain: string;
  webhookId: string;
  payload: string; // raw JSON body
}

export interface WebhookRegisterJobData {
  // Present for a single-store registration; absent for the nightly reverify-all.
  storeId?: string;
}

// Shared job options: collapse duplicate clicks per store, retry with backoff.
function storeJobOpts(jobId: string) {
  return {
    // BullMQ disallows ":" in custom job IDs.
    jobId,
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 50,
  };
}

let ordersBackfill: Queue<StoreJobData> | null = null;
let productsImport: Queue<StoreJobData> | null = null;

export function ordersBackfillQueue(): Queue<StoreJobData> {
  return (ordersBackfill ??= new Queue<StoreJobData>(ORDERS_BACKFILL_QUEUE, {
    connection,
  }));
}

export function productsImportQueue(): Queue<StoreJobData> {
  return (productsImport ??= new Queue<StoreJobData>(PRODUCTS_IMPORT_QUEUE, {
    connection,
  }));
}

export async function enqueueOrderBackfill(storeId: string) {
  return ordersBackfillQueue().add(
    "backfill",
    { storeId },
    storeJobOpts(`orders-backfill-${storeId}`),
  );
}

export async function enqueueProductImport(storeId: string) {
  return productsImportQueue().add(
    "import",
    { storeId },
    storeJobOpts(`products-import-${storeId}`),
  );
}

let shopifyWebhooks: Queue<WebhookJobData> | null = null;

export function shopifyWebhooksQueue(): Queue<WebhookJobData> {
  return (shopifyWebhooks ??= new Queue<WebhookJobData>(SHOPIFY_WEBHOOKS_QUEUE, {
    connection,
  }));
}

export async function enqueueWebhook(data: WebhookJobData) {
  return shopifyWebhooksQueue().add(data.topic || "webhook", data, {
    // Webhook id dedupes at the queue level too (Shopify uuids have no ":").
    jobId: data.webhookId || undefined,
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 200,
    removeOnFail: 200,
  });
}

let webhooksRegister: Queue<WebhookRegisterJobData> | null = null;

export function webhooksRegisterQueue(): Queue<WebhookRegisterJobData> {
  return (webhooksRegister ??= new Queue<WebhookRegisterJobData>(
    WEBHOOKS_REGISTER_QUEUE,
    { connection },
  ));
}

export async function enqueueWebhookRegistration(storeId: string) {
  return webhooksRegisterQueue().add(
    "register",
    { storeId },
    storeJobOpts(`webhooks-register-${storeId}`),
  );
}

let guardrails: Queue | null = null;

export function guardrailsQueue(): Queue {
  return (guardrails ??= new Queue(GUARDRAILS_QUEUE, { connection }));
}

let metricsRollup: Queue | null = null;

export function metricsRollupQueue(): Queue {
  return (metricsRollup ??= new Queue(METRICS_ROLLUP_QUEUE, { connection }));
}

let portfolioReview: Queue | null = null;

export function portfolioReviewQueue(): Queue {
  return (portfolioReview ??= new Queue(PORTFOLIO_REVIEW_QUEUE, { connection }));
}

let anomaly: Queue | null = null;

export function anomalyQueue(): Queue {
  return (anomaly ??= new Queue(ANOMALY_QUEUE, { connection }));
}
