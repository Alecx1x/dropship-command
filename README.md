# Dropship Command Center

A multi-store dropshipping command center: one app that **builds, tracks, and
maintains** multiple Shopify storefronts from a single dashboard. It connects
stores, ingests orders and products, watches margins, automates fulfillment
handoff, and tells you the true per-product, per-store profit.

> Status: **Phases 0–3 complete** (foundations, store sync, autonomous sync
> engine, profit tracking). Phase 4 (the AI layer) is pending an
> `ANTHROPIC_API_KEY`. See [`SPEC.md`](./SPEC.md) for the full roadmap.

## What it does

1. **Build** — connect a Shopify store with a custom-app token (verified live,
   stored encrypted).
2. **Track** — true profit per order/product/store: revenue − COGS − supplier
   shipping − payment fees − refunds, with blended vs breakeven ROAS.
3. **Maintain** — live webhook ingestion, margin guardrails, alerts, and a
   fulfillment-task queue.
4. **Decide** — AI-assisted product research scoring and weekly reviews *(Phase
   4, pending API key)*.

## Tech stack

- **Next.js 16** (App Router) — UI **and** API routes; TypeScript (strict).
- **PostgreSQL** via **Prisma 7** (driver adapter `@prisma/adapter-pg`).
- **BullMQ on Redis** for webhooks, sync jobs, and scheduled tasks.
- **NextAuth v5** credentials auth — env-defined owner + optional VA role
  (fulfillment-only); no users table.
- **Tailwind CSS** + **Recharts**. **Zod** on every external input/response.
- Managed infra: **Neon** (Postgres) + **Upstash** (Redis) — no Docker required.

## Architecture

```
/app                Next.js pages + API routes
  page.tsx          Portfolio dashboard (home)
  /profit           Profit & ROAS, kill/scale list
  /alerts /sync /fulfillment
  /stores           Store registration, detail (orders/products/ads tabs)
  /api/webhooks/shopify   HMAC-verified webhook receiver
/lib                Pure domain logic + data access
  /shopify          GraphQL client, bulk ops, webhook verify/registration
  /orders /products /profit /ads /guardrails /suppliers /alerts /webhooks
  /generated/prisma Generated Prisma client (gitignored)
/workers            BullMQ worker process + queues (npm run worker)
/prisma             schema.prisma + migrations + seed
/tests              Vitest unit tests (pure logic)
```

**Data flow:** Shopify → `/api/webhooks/shopify` (verify HMAC → dedupe → enqueue
→ 200) → BullMQ worker → upsert into Neon → dashboards read live. Heavy backfills
use Shopify bulk operations. Nightly/4-hourly jobs reverify webhooks, sweep
margins, and roll up daily profit metrics.

## Getting started

### Prerequisites

- Node 20+
- A **Neon** Postgres database and an **Upstash** Redis database (both free tier).

### Setup

```bash
npm install
cp .env.example .env          # then fill in the values (see below)
npx prisma migrate deploy     # apply migrations
npx prisma generate           # generate the client
npm run seed                  # demo store with fake data (optional)
```

### Environment

Copy `.env.example` to `.env` and set:

| Variable | What it is |
|----------|-----------|
| `DATABASE_URL` / `DIRECT_URL` | Neon pooled / direct connection strings |
| `REDIS_URL` | Upstash `rediss://` URL |
| `AUTH_SECRET` | NextAuth session secret |
| `AUTH_USER_EMAIL` / `AUTH_USER_PASSWORD_HASH` | Owner login (scrypt hash) |
| `AUTH_VA_EMAIL` / `AUTH_VA_PASSWORD_HASH` | Optional VA login — fulfillment-only access (scrypt hash); empty = disabled |
| `ENCRYPTION_KEY` | AES-256-GCM key (64 hex) for Shopify tokens at rest |
| `SHOPIFY_WEBHOOK_SECRET` | Verifies inbound webhook HMAC |
| `APP_URL` | Public base URL (for the webhook callback) |
| `GUARDRAIL_*`, `PAYMENT_FEE_*` | Guardrail/fee tuning (have defaults) |
| `RESEND_API_KEY`, `ALERT_EMAIL_TO` | Optional alert emails |
| `ANTHROPIC_API_KEY` | Phase 4 AI features |

### Run

```bash
npm run dev      # the web app (http://localhost:3000)
npm run worker   # the background job worker (run when testing jobs)
```

Log in with `AUTH_USER_EMAIL` and the password behind `AUTH_USER_PASSWORD_HASH`.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run worker` | BullMQ worker (queues + schedulers) |
| `npm run seed` | Seed a demo store |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |

## Background jobs

The worker process owns all background work and registers these schedulers on
boot:

- **Nightly 03:00** — re-verify each store's Shopify webhook registrations.
- **Every 4h** — margin guardrail sweep (alerts when margin drops below the floor).
- **Nightly 02:00** — rebuild daily profit metrics (`DailyMetric`).
- **Nightly 04:00** — anomaly sweep: refund-rate spikes and revenue drops vs a
  trailing baseline (runs after the 02:00 rollup so it reads fresh metrics).
- **Weekly Sun 09:00** — AI portfolio review, saved and emailed.

On-demand queues: order backfill, product import, webhook handling, webhook
registration.

## Conventions

- **Money is always integer cents** with a currency code — never floats.
- **Tenant isolation:** every domain table carries a `storeId`; queries are
  scoped by it.
- **Secrets** (Shopify tokens) are encrypted at rest with AES-256-GCM; the
  webhook HMAC is the webhook's authentication.
- Each SPEC task = one branch = one focused change, with tests for `/lib` logic.

## Testing

```bash
npm run test
```

Unit tests cover the pure domain logic — P&L math, profit ratios, the order/
product/refund parsers, CSV import, HMAC verification, guardrail math, and more.

## Deployment notes

Designed for managed infra: Vercel (or any Node host) for the app, Neon for
Postgres, Upstash for Redis. The **worker (`npm run worker`) is a long-running
process** and must run somewhere that supports that (a small VPS, Railway,
Render, etc.) — not on Vercel's serverless functions. Point `APP_URL` and the
Shopify webhook callback at the deployed URL.
