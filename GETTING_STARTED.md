# GETTING_STARTED.md — Your guided path (novice edition)

Read this once fully, then use it as a reference. It covers: (A) how to use
these files with Claude Code, (B) the dropshipping business itself — products,
ads, fulfillment — and (C) the things beginners learn the expensive way.

---

## A. Using these files with Claude Code

1. **Make a folder and drop these files in:**
   ```bash
   mkdir dropship-command && cd dropship-command
   # copy CLAUDE.md, SPEC.md, GETTING_STARTED.md here
   git init
   ```
2. **Start Claude Code in that folder** (`claude`). It automatically reads
   CLAUDE.md — that's the whole trick. CLAUDE.md is the project's standing
   instructions; SPEC.md is the to-do list.
3. **Your first session prompt, verbatim:**
   > Read CLAUDE.md and SPEC.md. Complete task 0.1, following all conventions.
   > When done, run typecheck and tests, check the task off in SPEC.md, and
   > commit with a conventional commit message.
4. **Repeat per task.** One task per session keeps context clean. If a session
   goes sideways, start fresh — the files carry the state, not the chat.
5. **Review every diff.** You're the architect; Claude Code is the builder.
   Ask "explain this file like I'm new to BullMQ" anytime — that's how you
   learn the codebase you own.
6. Docs if you need them: https://docs.claude.com/en/docs/claude-code/overview

---

## B. The business itself

### B1. Finding potentially profitable products (the honest method)

No tool guarantees winners. What works is a repeatable filter + fast testing.

**Where to hunt (free/cheap):**
- **Meta Ad Library** (facebook.com/ads/library): search niches; an ad running
  4+ weeks with many active variations = someone is profitably scaling it.
- **TikTok Creative Center / #TikTokMadeMeBuyIt:** raw demand signals.
- **Google Trends:** confirm rising vs dying interest; check seasonality.
- **Amazon Movers & Shakers + "frequently returned" flags:** demand + quality
  warnings.
- **AliExpress / CJdropshipping bestseller lists:** supply-side validation.
- Paid research tools (Sell The Trend, AutoDS product finder, ZIK) are fine
  accelerators once you're testing weekly — not required on day one.

**The filter (this becomes the Claude scoring rubric in Phase 4.1):**
1. Solves a problem OR has a visual "wow" (stops a scroll / earns a search).
2. **3x markup minimum** after shipping (e.g., $8 landed cost → sell $29.95).
   Under 3x, ad costs eat you alive.
3. Not in every Walmart/Target (or you offer a clearly better variant).
4. Light, unbreakable, no sizing (no apparel as a beginner — return rates).
5. Shippable to your market in ≤ 12 days (US/EU suppliers via Spocket/CJ
   warehouses beat 3-week China shipping on refund rates).
6. No regulatory landmines: avoid supplements/ingestibles, medical claims,
   electronics with batteries (shipping limits), trademarked/branded items.

**Testing discipline:** test products in small batches with a fixed budget
(e.g., $100–150 of ads per product), kill anything that doesn't show a
purchase or strong add-to-cart signal at that spend, and double down on
what survives. The portfolio mindset: most tests fail; the system wins.

### B2. Running effective ads — and the truth about Google Ads

Google Ads is genuinely good for dropshipping **when the product is something
people already search for** (problem/solution products: "posture corrector",
"dog nail grinder"). It captures *existing intent*. Meta/TikTok *create*
demand for impulse/wow products people didn't know existed. Match the channel
to the product type — many beginners run the wrong channel for their product
and conclude "ads don't work."

**Google Ads starter path (high-intent products):**
1. Set up **Google Merchant Center**, connect via Shopify's Google & YouTube
   app, get your product feed approved (accurate shipping + return policy
   pages are required — Google suspends merchants over this constantly).
2. Install conversion tracking properly BEFORE spending (purchase conversion
   with values). Bad tracking = flying blind = wasted budget.
3. Start with **Standard Shopping or Performance Max** at a modest daily
   budget per store (think $20–40/day), let it run 2 weeks before judging —
   the algorithm needs conversion data.
4. Add **Search campaigns** on exact/phrase keywords for your best product
   ("buy [product]", "[problem] solution"). Use the ad copy generator
   (Phase 4.2) for responsive search ad assets.
5. **Know your breakeven ROAS** = price ÷ gross profit per unit. Selling at
   $30 with $12 total cost → gross profit $18 → breakeven ROAS ≈ 1.67. The
   dashboard (Phase 3.3) shows this per product; scale above it, kill below.
6. Naming convention from day one: campaigns named `STORE-PRODUCT-TYPE`
   (e.g., `GLOW-neckfan-pmax`) so the Phase 5.1 API integration can
   auto-match spend to products.

**Budget reality:** plan on $500–1,500 of "tuition" ad spend across your first
product tests before your first consistent winner. If a guru says less,
they're selling a course.

### B3. Filling orders autonomously

The autonomous chain you're building toward (Phase 2.6):

```
Customer pays on Shopify
  → orders/create webhook hits your app (seconds)
  → app routes order to the supplier adapter (AutoDS API, etc.)
  → supplier ships → tracking number returns via adapter
  → app pushes fulfillment + tracking to Shopify
  → Shopify emails the customer automatically
```

Practical path: start with **AutoDS or DSers connected directly to each store**
(they're proven; let them place supplier orders), while your app ingests
everything for the unified dashboard. Then migrate fulfillment into your own
adapters when volume justifies it. Don't rebuild plumbing before you have
water flowing.

Supplier picks for a beginner: **CJdropshipping** (US warehouses, no minimums,
has an API), **Spocket** (US/EU suppliers, faster shipping), **AutoDS
marketplace** (most automated). Always order a sample of anything you scale —
you are legally the seller of record, and quality is your problem.

---

## C. Things beginners learn the expensive way

1. **Form an LLC + get an EIN before real revenue** (in Oklahoma it's cheap and
   online). Payment processors (Shopify Payments/Stripe) want a real business;
   personal-name accounts get frozen during reviews. Also: sales tax — Shopify
   collects, but YOU remit. TaxJar or Shopify Tax automates it; don't ignore it.
2. **Cash flow gap:** Shopify pays out in ~2–3 days but ad platforms and
   suppliers charge immediately; refunds claw back. Keep a float (a few
   thousand dollars) before scaling spend.
3. **Refund/chargeback rate is the silent killer.** Over ~1% chargebacks and
   processors put you on reserve or drop you. Fast shipping, honest delivery
   estimates on the product page, and responsive support email are not
   optional. (This is why Phase 3.4 exists.)
4. **Policies pages** (shipping, returns, privacy, terms) are required by
   Google Merchant Center, payment processors, AND customers. Templated in the
   Phase 4.3 launch playbook.
5. **One store until it works.** The multi-store app is the destination; the
   path is: make store #1 do $X/day profitably, template what worked, THEN
   clone. Multiple unprofitable stores just multiply losses.
6. **Track profit, not revenue.** A $10k/month revenue store can lose money.
   Your Phase 3 dashboard exists because most dropshippers discover this at
   month-end.

---

## Your literal next 7 steps

1. Copy these 3 files into a new folder, `git init`, start Claude Code.
2. Work tasks 0.1 → 0.4 (one evening or two).
3. Create your first Shopify store (basic plan, dev trial first), create a
   custom app in its admin to get an Admin API token.
4. Work Phase 1 tasks until your dashboard shows that store live.
5. While Claude Code builds, do product research (B1) — gather 10 candidates.
6. Form the LLC, set up Merchant Center groundwork (B2 step 1–2).
7. First product test with a fixed budget; let the data, not hope, decide.
