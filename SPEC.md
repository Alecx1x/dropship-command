# SPEC.md — Dropship Command Center

A phased, checkable build plan. Work top to bottom. Each task is sized to be
one Claude Code session or less. Check tasks off as they're completed.

---

## Phase 0 — Foundations

- [x] **0.1 Scaffold repo.** `create-next-app` (TypeScript, App Router, Tailwind),
      add Prisma, BullMQ, ioredis, zod, shadcn/ui init. Add npm scripts:
      `dev`, `build`, `typecheck`, `test`, `worker` (runs BullMQ workers).
- [x] **0.2 Docker compose for local dev.** Postgres 16 + Redis 7 services,
      `.env.example` documenting every variable (DATABASE_URL, REDIS_URL,
      ENCRYPTION_KEY, ANTHROPIC_API_KEY, NEXTAUTH_SECRET).
- [x] **0.3 Auth.** Single-user auth (NextAuth credentials or magic link).
      Every dashboard route and API route requires a session.
- [x] **0.4 Prisma schema v1.** Models below. Run first migration + seed script
      that creates one demo store with fake data so the UI is never empty.

### Schema v1 (Prisma sketch)

```
Store        id, name, platform(SHOPIFY), shopDomain, accessTokenEnc,
             status(ACTIVE/PAUSED/ARCHIVED), currency, createdAt
Product      id, storeId→Store, shopifyProductId, title, status,
             supplierId→Supplier?, costCents, shipCostCents, priceCents,
             compareAtCents, niche, researchScore, createdAt
Supplier     id, name, type(AUTODS/SPOCKET/CJ/MANUAL), apiKeyEnc?, notes
Order        id, storeId→Store, shopifyOrderId, orderNumber, placedAt,
             financialStatus, fulfillmentStatus, customerEmail,
             revenueCents, shippingChargedCents, taxCents, currency
OrderItem    id, orderId→Order, productId→Product?, qty, priceCents, costCents
AdSpend      id, storeId→Store, date, channel(GOOGLE/META/TIKTOK/OTHER),
             campaignName, spendCents, clicks, impressions, conversions
SyncLog      id, storeId→Store?, kind(ORDERS/PRODUCTS/STOCK/PRICES/ADS),
             startedAt, finishedAt, ok, itemsTouched, errorText?
ResearchItem id, title, sourceUrl, niche, supplierCostCents, estPriceCents,
             score, scoreRationale, status(IDEA/TESTING/LIVE/KILLED), storeId?
Alert        id, storeId→Store?, severity, kind, message, createdAt, readAt?
```

Indexes: every storeId; (storeId, placedAt) on Order; (storeId, date, channel)
unique on AdSpend.

---

## Phase 1 — Connect stores & see money (the "wow" milestone)

- [x] **1.1 Encrypted token storage.** `lib/crypto.ts` AES-256-GCM
      encrypt/decrypt helpers + tests.
- [x] **1.2 Store registration UI.** Form: store name, myshopify domain, admin
      API access token (from a per-store Shopify custom app). On save: encrypt
      token, run a test GraphQL `shop { name currencyCode }` query, show
      success/failure.
- [x] **1.3 Shopify GraphQL client.** `lib/shopify/client.ts` — versioned
      endpoint, cost-aware throttling, retry with backoff, typed via zod.
- [x] **1.4 Order backfill job.** BullMQ job: paginate last 90 days of orders
      via GraphQL bulk operations, upsert Order/OrderItem, write SyncLog.
- [x] **1.5 Product import job.** Pull all products + variants, upsert Product.
      Manual COGS entry UI for products without supplier links yet.
- [x] **1.6 Portfolio dashboard v1.** One screen: per-store cards (today / 7d /
      30d revenue, order count, status dot from latest SyncLog) + combined
      totals row + revenue-over-time chart (all stores stacked).
- [x] **1.7 Store detail page v1.** Orders table (paginated, filterable),
      products table with inline COGS editing.

**Definition of done for Phase 1:** two real stores connected; combined and
per-store revenue visible on one screen; data refreshable on demand.

---

## Phase 2 — The sync engine (maintain autonomously)

- [x] **2.1 Webhook endpoint + HMAC verification.** `/api/webhooks/shopify`.
      Verify, dedupe, enqueue, 200. Topics: orders/create, orders/updated,
      products/update, inventory_levels/update, app/uninstalled.
- [x] **2.2 Webhook registration job.** On store connect, register all topics
      via GraphQL; nightly job re-verifies registrations.
- [x] **2.3 Live order ingestion worker.** orders/create → upsert + recalc
      day's metrics + trigger fulfillment handoff (Phase 2.6).
- [x] **2.4 Price/stock guardrails.** Scheduled job (every 4h) per supplier-
      linked product: if supplier cost rises so margin < configured floor →
      Alert + optional auto-reprice rule (cost × multiplier, psychological
      .95 rounding). If supplier out of stock → Alert + optional auto-set
      Shopify inventory to 0 (stockout protection).
      [margin guardrail done; stockout half lands with the supplier feed in 2.6]
- [x] **2.5 Alerts center + notifications.** Alert list UI, unread badge,
      optional email (Resend) for severity ≥ HIGH (margin breach, sync
      failure, stockout on a top-10 product).
- [x] **2.6 Fulfillment handoff (autonomous orders).** Strategy interface
      `SupplierAdapter { placeOrder, getTracking, getStockPrice }`.
      v1 adapters: AutoDS (API) and MANUAL (queue of "place this yourself"
      tasks with one-click supplier links). Tracking numbers flow back →
      push fulfillment + tracking to Shopify → customer email fires.
      [interface + MANUAL adapter + FulfillmentTask + handoff + tasks UI done;
      AutoDS API adapter stubbed, Shopify fulfillment push is a follow-up (needs
      fulfillmentOrder GIDs)]
- [x] **2.7 Sync health page.** SyncLog explorer; red banner on dashboard if
      any store has a failed sync in last 24h.

**Definition of done:** an order placed on any store appears in the dashboard
within seconds, is routed to the supplier without manual entry, and tracking
flows back automatically. Price/stock changes can't silently destroy margin.

---

## Phase 3 — Profit truth (track)

- [x] **3.1 P&L engine.** `lib/profit/` pure functions: per order →
      revenue − COGS − supplier shipping − payment fees (configurable %+fixed)
      − refunds. Per product/day/store rollups stored in a `DailyMetric` table
      (add to schema). Unit tests with golden cases.
- [x] **3.2 Ad spend ingestion v1 (manual + CSV).** UI + CSV import for daily
      spend per store/channel/campaign. (API integrations are Phase 5.)
- [x] **3.3 Profit dashboard.** Per store: profit today/7d/30d, margin %,
      blended ROAS, breakeven ROAS line. Per product: profit ranked table —
      this is the kill/scale list.
- [x] **3.4 Refund/chargeback tracking.** Ingest refunds via webhook; show
      refund rate per product (early-warning quality signal).

---

## Phase 4 — Build & decide (AI layer + launch playbook)

- [x] **4.1 Research pipeline.** ResearchItem intake form + bookmarklet-style
      quick add. Claude scoring: given title, niche, cost, target price, and
      pasted evidence (ad library notes, trend data), return 0–100 score +
      rationale across: problem-solving value, wow factor, margin ≥ 3x,
      shippability, competition saturation, seasonality. Store rationale.
- [x] **4.2 Listing copy generator.** For a TESTING product: Claude generates
      title, description, 5 ad angles, 3 Google responsive-search-ad asset
      sets. Human approves before anything publishes.
- [x] **4.3 Store launch playbook.** Checklist template instantiated per new
      store (domain, theme, policies pages, payment provider, shipping
      settings, pixel/tag setup, first 5 products). Progress tracked in app.
- [x] **4.4 Weekly portfolio review.** Sunday cron: Claude receives each
      store's weekly metrics and produces a written review — what to scale,
      what to kill, anomalies — saved + emailed.

---

## Phase 5 — Scale (after first consistently profitable store)

- [ ] 5.1 Google Ads API integration (real daily spend + conversions per
      campaign, auto-matched to products via UTM/campaign naming convention).
- [ ] 5.2 Meta Ads API integration.
- [ ] 5.3 Supplier auto-routing (cheapest/fastest in-stock supplier per order).
- [x] 5.4 Multi-user roles (VA: fulfillment + support views only). Optional
      env-defined VA account (`AUTH_VA_EMAIL`/`AUTH_VA_PASSWORD_HASH`) gets the
      VA role; role threads through the JWT and the edge proxy gates routes —
      a VA reaches only `/fulfillment`, everything else redirects there. No
      users table (auth stays env-defined). `lib/auth/roles.ts`. ("Support
      views" = fulfillment for now; no support inbox — out of scope v1.)
- [ ] 5.5 WooCommerce adapter (platform abstraction already exists via
      `platform` field — implement second driver).
- [x] 5.6 Anomaly detection job (conversion-rate or refund-rate spikes).
      Nightly sweep: refund-rate spikes + revenue drops vs a 14-day trailing
      baseline, deduped per (store, kind, day) → alerts. True conversion-rate
      needs session/traffic data not ingested (out of scope v1); revenue-drop is
      the available proxy. `lib/anomaly/{config,detect,run}.ts`.

---

## Explicitly out of scope (v1)

- Building the storefronts themselves inside this app (Shopify hosts those).
- Holding inventory, 3PL integration.
- Customer support inbox (use Shopify Inbox / email until Phase 5+).
