import "dotenv/config";

import { Worker } from "bullmq";

import { prisma } from "../lib/db";
import { runMarginGuardrails } from "../lib/guardrails/run";
import { rebuildRecentDailyMetrics } from "../lib/profit/rollup";
import { backfillStoreOrders } from "../lib/orders/backfill";
import { importStoreProducts } from "../lib/products/import";
import { handleWebhook } from "../lib/webhooks/handle";
import { registerStoreWebhooks } from "../lib/webhooks/register";
import { runWeeklyReview } from "../lib/review/run";
import { runAnomalyDetection } from "../lib/anomaly/run";
import { createConnection } from "./connection";
import {
  ANOMALY_QUEUE,
  anomalyQueue,
  enqueueWebhookRegistration,
  GUARDRAILS_QUEUE,
  guardrailsQueue,
  METRICS_ROLLUP_QUEUE,
  metricsRollupQueue,
  ORDERS_BACKFILL_QUEUE,
  PORTFOLIO_REVIEW_QUEUE,
  portfolioReviewQueue,
  PRODUCTS_IMPORT_QUEUE,
  SHOPIFY_WEBHOOKS_QUEUE,
  WEBHOOKS_REGISTER_QUEUE,
  webhooksRegisterQueue,
  type StoreJobData,
  type WebhookJobData,
  type WebhookRegisterJobData,
} from "./queues";

/**
 * Worker process entry point — started with `npm run worker`. A single
 * long-running process owns all background processing (CLAUDE.md: "All real
 * work happens in workers").
 *
 * `drainDelay: 60` keeps idle Redis polling low so a continuously-running
 * worker doesn't chew through Upstash's free command quota; new jobs still wake
 * the worker immediately when enqueued.
 */
async function main() {
  const connection = createConnection();
  await connection.ping();

  const ordersWorker = new Worker<StoreJobData>(
    ORDERS_BACKFILL_QUEUE,
    async (job) => backfillStoreOrders(job.data.storeId),
    { connection, concurrency: 2, drainDelay: 60 },
  );
  ordersWorker.on("completed", (job, result) => {
    console.log(`[orders-backfill] job ${job.id} completed:`, result);
  });
  ordersWorker.on("failed", (job, err) => {
    console.error(`[orders-backfill] job ${job?.id} failed:`, err?.message);
  });

  const productsWorker = new Worker<StoreJobData>(
    PRODUCTS_IMPORT_QUEUE,
    async (job) => importStoreProducts(job.data.storeId),
    { connection, concurrency: 2, drainDelay: 60 },
  );
  productsWorker.on("completed", (job, result) => {
    console.log(`[products-import] job ${job.id} completed:`, result);
  });
  productsWorker.on("failed", (job, err) => {
    console.error(`[products-import] job ${job?.id} failed:`, err?.message);
  });

  const webhooksWorker = new Worker<WebhookJobData>(
    SHOPIFY_WEBHOOKS_QUEUE,
    async (job) => handleWebhook(job.data),
    { connection, concurrency: 4, drainDelay: 60 },
  );
  webhooksWorker.on("completed", (job) => {
    console.log(`[webhooks] ${job.data.topic} (${job.id}) handled`);
  });
  webhooksWorker.on("failed", (job, err) => {
    console.error(`[webhooks] job ${job?.id} failed:`, err?.message);
  });

  const registerWorker = new Worker<WebhookRegisterJobData>(
    WEBHOOKS_REGISTER_QUEUE,
    async (job) => {
      // Nightly job: fan out a registration for every active store.
      if (job.name === "reverify-all") {
        const stores = await prisma.store.findMany({
          where: { status: "ACTIVE" },
          select: { id: true },
        });
        for (const s of stores) await enqueueWebhookRegistration(s.id);
        return { reverified: stores.length };
      }
      if (!job.data.storeId) return { skipped: true };
      return registerStoreWebhooks(job.data.storeId);
    },
    { connection, concurrency: 2, drainDelay: 60 },
  );
  registerWorker.on("completed", (job, result) => {
    console.log(`[webhooks-register] job ${job.id} done:`, result);
  });
  registerWorker.on("failed", (job, err) => {
    console.error(`[webhooks-register] job ${job?.id} failed:`, err?.message);
  });

  const guardrailsWorker = new Worker(
    GUARDRAILS_QUEUE,
    async () => runMarginGuardrails(),
    { connection, concurrency: 1, drainDelay: 60 },
  );
  guardrailsWorker.on("completed", (job, result) => {
    console.log(`[guardrails] job ${job.id} done:`, result);
  });
  guardrailsWorker.on("failed", (job, err) => {
    console.error(`[guardrails] job ${job?.id} failed:`, err?.message);
  });

  // Nightly (03:00) re-verify of all stores' webhook registrations (SPEC 2.2).
  await webhooksRegisterQueue().upsertJobScheduler(
    "nightly-webhook-reverify",
    { pattern: "0 3 * * *" },
    { name: "reverify-all", data: {} },
  );

  // Every 4 hours: margin guardrail sweep (SPEC 2.4).
  await guardrailsQueue().upsertJobScheduler(
    "guardrails-every-4h",
    { pattern: "0 */4 * * *" },
    { name: "run", data: {} },
  );

  const metricsWorker = new Worker(
    METRICS_ROLLUP_QUEUE,
    async () => rebuildRecentDailyMetrics(),
    { connection, concurrency: 1, drainDelay: 60 },
  );
  metricsWorker.on("completed", (job, result) => {
    console.log(`[metrics-rollup] job ${job.id} done:`, result);
  });
  metricsWorker.on("failed", (job, err) => {
    console.error(`[metrics-rollup] job ${job?.id} failed:`, err?.message);
  });

  // Nightly (02:00): rebuild recent daily profit metrics (SPEC 3.1).
  await metricsRollupQueue().upsertJobScheduler(
    "metrics-rollup-nightly",
    { pattern: "0 2 * * *" },
    { name: "run", data: {} },
  );

  const reviewWorker = new Worker(
    PORTFOLIO_REVIEW_QUEUE,
    async () => runWeeklyReview(),
    { connection, concurrency: 1, drainDelay: 60 },
  );
  reviewWorker.on("completed", (job, result) => {
    console.log(`[portfolio-review] job ${job.id} done:`, result);
  });
  reviewWorker.on("failed", (job, err) => {
    console.error(`[portfolio-review] job ${job?.id} failed:`, err?.message);
  });

  // Weekly (Sunday 09:00): generate + email the portfolio review (SPEC 4.4).
  await portfolioReviewQueue().upsertJobScheduler(
    "portfolio-review-weekly",
    { pattern: "0 9 * * 0" },
    { name: "run", data: {} },
  );

  const anomalyWorker = new Worker(
    ANOMALY_QUEUE,
    async () => runAnomalyDetection(),
    { connection, concurrency: 1, drainDelay: 60 },
  );
  anomalyWorker.on("completed", (job, result) => {
    console.log(`[anomaly] job ${job.id} done:`, result);
  });
  anomalyWorker.on("failed", (job, err) => {
    console.error(`[anomaly] job ${job?.id} failed:`, err?.message);
  });

  // Nightly (04:00): anomaly sweep — after the 02:00 metrics rollup so it reads
  // fresh DailyMetric rows (SPEC 5.6).
  await anomalyQueue().upsertJobScheduler(
    "anomaly-nightly",
    { pattern: "0 4 * * *" },
    { name: "run", data: {} },
  );

  console.log("[worker] connected to Redis — listening for jobs");
}

main().catch((err) => {
  console.error("[worker] failed to start:", err);
  process.exit(1);
});
