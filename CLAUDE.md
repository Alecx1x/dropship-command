# CLAUDE.md — Dropship Command Center

This file is read by Claude Code at the start of every session. It defines what
this project is, how it's built, and the rules that must never be broken.

## What this project is

A multi-store dropshipping command center: one web app that builds, tracks, and
maintains multiple dropshipping storefronts (Shopify first) from a single
dashboard. The owner (Anpi) is the only user initially; role-based access
comes later.

Core jobs of the app:
1. **Build** — templated store-launch playbooks so a new store goes live in days.
2. **Track** — true per-product, per-store profit (revenue − COGS − shipping − fees − ad spend).
3. **Maintain** — automated price/stock sync, order fulfillment handoff, alerts.
4. **Decide** — AI-assisted product research scoring and weekly scale/kill recommendations.

## Tech stack (do not substitute without asking)

- **Language:** TypeScript everywhere (strict mode on).
- **App framework:** Next.js 16 (App Router) — frontend AND API routes in one repo.
  Note: middleware is `proxy.ts` (Next 16's renamed middleware).
- **Database:** PostgreSQL (managed **Neon**) via Prisma 7 — the engine-free
  `prisma-client` generator with the `@prisma/adapter-pg` driver adapter.
  Connection URLs live in `prisma.config.ts`, NOT in schema.prisma (Prisma 7
  rejects them there); migrations use `DIRECT_URL`, runtime uses the pooled URL.
- **Jobs/queues:** BullMQ on Redis (managed **Upstash**, `rediss://`) for
  webhooks, sync jobs, and scheduled tasks. Run with `npm run worker`.
- **UI:** Tailwind CSS + shadcn/ui components. Recharts for charts.
- **Shopify:** GraphQL Admin API (NOT REST unless an endpoint is GraphQL-unavailable).
  One custom-app access token per store, stored encrypted in the DB.
- **AI:** Anthropic API for product scoring, copy generation, weekly reviews.
- **Validation:** Zod on every API input and every external API response.

## Non-negotiable architecture rules

1. **Tenant isolation.** Every domain table has a `storeId` foreign key. Every
   query is scoped by `storeId`. No raw queries that skip the scope. Cross-store
   views aggregate explicitly; they never accidentally leak.
2. **Secrets live in the DB (encrypted) or .env, never in code.** Shopify tokens
   are encrypted at rest with AES-256-GCM using `ENCRYPTION_KEY` from env.
   `.env` is gitignored. Never print tokens in logs.
3. **Webhooks are fast and idempotent.** A webhook handler verifies HMAC,
   enqueues a BullMQ job, and returns 200 in <1s. All real work happens in
   workers. Every webhook has a dedupe key (webhook id) so retries are safe.
4. **Money is integers.** All currency is stored as integer cents with a
   currency code. Never floats.
5. **External calls are resilient.** Every Shopify/supplier API call goes
   through a wrapper with retry + exponential backoff + rate-limit awareness
   (respect Shopify's GraphQL cost throttling).
6. **Sync is observable.** Every sync run writes to `sync_logs` (what ran, for
   which store, items touched, errors). The dashboard surfaces failures loudly.

## Project layout

```
/app            Next.js app router pages + API routes
  /(dashboard)  Authenticated UI
  /api          Route handlers (thin: validate → enqueue or query → respond)
/lib            Domain logic (pure, testable)
  /shopify      GraphQL client, queries, webhook verification
  /suppliers    Supplier adapters (AutoDS, Spocket, manual)
  /profit       P&L calculation engine
  /ai           Anthropic API helpers (scoring, copy, weekly review)
/workers        BullMQ workers + queue definitions
/prisma         schema.prisma + migrations + seed
/tests          Vitest unit tests for /lib, integration tests for API routes
```

## Conventions

- Conventional commits (`feat:`, `fix:`, `chore:`). Small commits per task.
- Each SPEC.md task = one branch = one PR-sized change, even working solo.
- Write/update tests for any /lib change before marking a task done.
- After completing a SPEC task, check it off in SPEC.md in the same commit.
- Run `npm run typecheck && npm run test` before declaring any task complete.
- When uncertain about a Shopify API shape, fetch the official docs rather
  than guessing — the GraphQL schema changes between API versions. Pin the
  API version in one constant: `lib/shopify/constants.ts`.

## Owner context (for tone & decisions)

- Owner is technical (solutions architect) but new to dropshipping as a
  business. When a task touches business logic (pricing rules, ad metrics,
  refund flows), explain the WHY in comments and in the session summary.
- Default to the simplest thing that works; this runs on one VPS/Vercel +
  managed Postgres + managed Redis until store #3 is profitable.

## Current status (as of 2026-06-14)

**Phases 0–4 are DONE; Phase 5 is partial.** See SPEC.md for the live checkboxes.
- Phases 0–3: auth, store registration, full Shopify sync (orders/products/
  webhooks), guardrails, alerts, fulfillment handoff, sync health, P&L engine,
  ad spend, profit/ROAS dashboard, refunds.
- Phase 4 (AI layer): Claude product scoring (4.1), listing copy (4.2), launch
  playbook (4.3), weekly portfolio review (4.4) — all live-verified against the
  real Anthropic API. `ANTHROPIC_API_KEY` is set in `.env` (reused from the
  user's claude-control app). AI helpers live in `lib/ai/`; model pinned in
  `lib/ai/constants.ts` (defaults to `claude-sonnet-4-6`, override via env).
- Phase 5 (partial): **5.6 anomaly detection** (`lib/anomaly/`, nightly sweep)
  and **5.4 VA role** (`lib/auth/roles.ts`) are done. Remaining 5.1/5.2
  (Google/Meta Ads APIs) are blocked on a live, profitable store. The `/guide`
  page is a full interactive 15-module operating curriculum.
- ~117 tests green. Read the SPEC before assuming a task is or isn't done.

**Auth:** env-defined accounts, no users table. `AUTH_USER_EMAIL` /
`AUTH_USER_PASSWORD_HASH` = owner; optional `AUTH_VA_EMAIL` /
`AUTH_VA_PASSWORD_HASH` = VA (fulfillment-only). `auth.config.ts` has
`trustHost: true`; **do NOT set `NEXTAUTH_URL`** (it breaks tunnel access —
the launcher sets `AUTH_URL` to the public URL at runtime). **TEMP:**
`DISABLE_AUTH="true"` in `.env` currently makes the whole app public (no login)
for personal use — re-enable login by removing it.

**Remote access:** `start-remote.bat` → `start-remote.ps1` runs the prod app +
worker behind a Cloudflare quick tunnel (URL changes per launch). The user
often just asks Claude to "set the tunnel back up" — see the
`dropship-remote-access` memory for the exact restart steps.

Work one SPEC task at a time, each on its own branch (the repo chains feature
branches; `master` is just the initial spec commit). Keep typecheck + tests +
build green before declaring a task done.
