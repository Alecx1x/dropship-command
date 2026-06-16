"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Interactive operating curriculum. Two interactive systems:
 *
 *  1. Progress — every actionable step is a <Check> that registers its id with a
 *     context provider and persists checked state to localStorage, so the owner
 *     can work the course like a living checklist across sessions. A sticky bar
 *     shows overall completion.
 *  2. Navigation — collapsible modules and a scroll-spy table of contents.
 *
 * Each module ends with a <Resources> block of external "learn more" links
 * (third-party sites — official platforms, free courses, tools, communities).
 * Pure presentation, no app data, so it stays a client component.
 */

// ---------------------------------------------------------------------------
// Progress (localStorage-backed checklist)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "dc-guide-progress-v2";

interface ProgressCtx {
  done: Set<string>;
  total: number;
  doneCount: number;
  toggle: (id: string) => void;
  register: (id: string) => void;
  reset: () => void;
}

const Ctx = createContext<ProgressCtx | null>(null);

function useProgress(): ProgressCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useProgress must be used inside the guide provider");
  return c;
}

function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [registered, setRegistered] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore corrupt/blocked storage
    }
  }, []);

  const persist = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // ignore quota/private-mode errors
    }
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setDone((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const register = useCallback((id: string) => {
    setRegistered((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setDone(new Set());
    persist(new Set());
  }, [persist]);

  const doneCount = useMemo(
    () => [...done].filter((id) => registered.has(id)).length,
    [done, registered],
  );

  const value: ProgressCtx = {
    done,
    total: registered.size,
    doneCount,
    toggle,
    register,
    reset,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function ProgressBar() {
  const { total, doneCount, reset } = useProgress();
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="sticky top-0 z-10 -mx-6 mb-2 border-b border-black/[.06] bg-white/85 px-6 py-3 backdrop-blur dark:border-white/[.1] dark:bg-zinc-950/85">
      <div className="flex items-center justify-between gap-4">
        <span className="text-base font-medium text-zinc-600 dark:text-zinc-300">
          Curriculum progress: {doneCount}/{total} steps ({pct}%)
        </span>
        <button
          type="button"
          onClick={reset}
          className="text-base text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          Reset
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300 dark:bg-emerald-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** A checkable step. Its `id` must be stable and unique across the guide. */
function Check({ id, children }: { id: string; children: React.ReactNode }) {
  const { done, toggle, register } = useProgress();
  useEffect(() => {
    register(id);
  }, [id, register]);

  const checked = done.has(id);
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => toggle(id)}
        className="mt-1.5 h-4 w-4 shrink-0 accent-emerald-500"
      />
      <span
        className={
          checked
            ? "text-zinc-400 line-through dark:text-zinc-600"
            : "text-zinc-700 dark:text-zinc-300"
        }
      >
        {children}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Navigation (scroll-spy TOC)
// ---------------------------------------------------------------------------

const SECTIONS = [
  ["start", "How to use this"],
  ["m1", "1 · Mindset & the model"],
  ["m2", "2 · Set up the business"],
  ["m3", "3 · Pick your niche"],
  ["m4", "4 · Product research"],
  ["m5", "5 · Sourcing & suppliers"],
  ["m6", "6 · A store that converts"],
  ["m7", "7 · Offer, price & AOV"],
  ["m8", "8 · Traffic: testing"],
  ["m9", "9 · Traffic: creative"],
  ["m10", "10 · Traffic: scaling"],
  ["m11", "11 · Read the numbers"],
  ["m12", "12 · Retention & LTV"],
  ["m13", "13 · Ops & support"],
  ["m14", "14 · Risk & survival"],
  ["m15", "15 · Build the portfolio"],
  ["cadence", "Operating cadence"],
  ["mistakes", "Top mistakes"],
  ["kpis", "KPI targets"],
  ["library", "Resource library"],
  ["roadmap", "Roadmap — what's next"],
  ["screens", "Screen reference"],
  ["glossary", "Glossary"],
] as const;

const SECTION_IDS = SECTIONS.map(([id]) => id);

function useActiveSection(): string {
  const [active, setActive] = useState<string>(SECTION_IDS[0]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -75% 0px" },
    );
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return active;
}

function Toc({ active }: { active: string }) {
  return (
    <nav className="mt-6 rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950">
      <div className="mb-2 text-base font-medium uppercase tracking-wide text-zinc-400">
        Curriculum
      </div>
      <ol className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {SECTIONS.map(([id, label]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={
                active === id
                  ? "font-medium text-emerald-600 dark:text-emerald-400"
                  : "text-lg text-zinc-600 hover:text-black hover:underline dark:text-zinc-300 dark:hover:text-white"
              }
            >
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function GuideClient() {
  const active = useActiveSection();

  return (
    <ProgressProvider>
      <div className="mx-auto max-w-3xl px-6 py-10 tracking-[0.02em]">
        <Link
          href="/"
          className="text-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          The Dropshipping Curriculum
        </h1>
        <p className="mt-2 text-xl leading-8 text-zinc-600 dark:text-zinc-300">
          A complete, ordered course — from zero to a profitable multi-store
          portfolio. Fifteen modules, each with what to master, the exact steps
          to take (tick them off — progress saves on this device), the math, the
          mistakes that sink beginners, how this app does the heavy lifting, and
          a <strong>Learn more</strong> box of hand-picked outside resources.
          Work it top to bottom for your first store; return to any module
          forever after.
        </p>

        <ProgressBar />
        <Toc active={active} />

        {/* How to use */}
        <Section id="start" title="How to use this curriculum">
          <p>
            This is a sequence, not a pile of tips. Modules 1–7 get your first
            store ready to sell; 8–11 are the engine (traffic and the numbers
            that prove it works); 12–14 are how you keep more of the money and
            survive; 15 is how you turn one win into many.
          </p>
          <KeyIdea>
            The rule the whole course serves:{" "}
            <strong>
              make ONE store profitable, template exactly what worked, then
              clone.
            </strong>{" "}
            Most beginners fail by scaling spend, or opening store #2, before
            store #1 actually nets money.
          </KeyIdea>
          <p>Three truths to anchor on before you spend a dollar:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Profit, not revenue.</strong> A $20k/month store can lose
              money. The{" "}
              <Link href="/profit" className="underline">
                Profit screen
              </Link>{" "}
              is the only scoreboard that counts.
            </li>
            <li>
              <strong>Most tests fail — on purpose.</strong> You run a portfolio
              of cheap experiments; the portfolio wins, not any one product.
            </li>
            <li>
              <strong>The refund/chargeback rate is the silent killer.</strong>{" "}
              Past ~1% chargebacks, processors reserve or drop you and the
              business is over regardless of sales.
            </li>
          </ul>
          <Callout>
            <strong>About the &ldquo;Learn more&rdquo; links:</strong> they point
            to third-party sites (official ad platforms, free courses, tools,
            and communities) that I don&apos;t own or control. They&apos;re
            starting points, not endorsements — sites move and tools change, so
            treat them as a map, not gospel, and never pay for a tool until a
            free one has stopped being enough.
          </Callout>
        </Section>

        {/* Module 1 */}
        <Module
          id="m1"
          n={1}
          title="Mindset & the business model"
          master="How dropshipping actually makes (and loses) money, and the operator mindset that wins."
        >
          <p>
            Dropshipping: you run the storefront and marketing; a supplier holds
            stock and ships when you get an order. You never touch inventory.
            Your edge is not a secret product — it is{" "}
            <Term>a profitable system</Term>: find demand, put the right offer in
            front of it, and keep more per order than the sale costs.
          </p>
          <KeyIdea>
            You are a media buyer with a checkout attached. The product is
            replaceable; the skill that compounds is reading numbers and making
            unemotional kill/scale decisions fast.
          </KeyIdea>
          <Formula>
            profit = revenue − product cost − shipping − payment fees − refunds −
            ad spend
          </Formula>
          <p>
            Beginners forget the last three. Payment fees (~2.9% + 30¢) and ad
            spend flip a &ldquo;profitable&rdquo; store into a losing one;
            refunds claw back revenue you already counted.
          </p>
          <Check id="m1-portfolio">
            Adopt the portfolio mindset: expect ~8 of 10 tests to fail, budget
            for it, and judge yourself on the portfolio&apos;s profit.
          </Check>
          <Check id="m1-data">
            Decide with data, not ego: a product you love that does not clear
            breakeven gets killed, fast.
          </Check>
          <Check id="m1-speed">
            Move fast on cheap, reversible decisions (creatives, prices); move
            carefully on expensive, hard-to-reverse ones (scaling spend, new
            stores).
          </Check>
          <Avoid>
            <strong>Beginner traps:</strong> hunting &ldquo;the perfect
            product&rdquo; for weeks instead of testing; tracking revenue while
            losing money; quitting after 2–3 failed tests; scaling on hope.
          </Avoid>
          <Resources
            items={[
              ["What is dropshipping? (Shopify guide)", "https://www.shopify.com/blog/what-is-dropshipping"],
              ["r/dropship — community Q&A", "https://www.reddit.com/r/dropship/"],
              ["r/ecommerce — broader store-owner community", "https://www.reddit.com/r/ecommerce/"],
              ["Shopify Learn (free courses)", "https://www.shopify.com/learn"],
            ]}
          />
        </Module>

        {/* Module 2 */}
        <Module
          id="m2"
          n={2}
          title="Set up the business"
          master="A legal, bankable foundation so your money never gets frozen and your store looks trustworthy."
        >
          <p>
            Do this before real revenue arrives. Processors review new merchants
            and freeze anything risky — personal-name accounts, no policies,
            mismatched details. A clean setup is cheap insurance.
          </p>
          <Check id="m2-llc">
            Form an LLC and get an EIN (the EIN is free from the IRS) — it
            separates you legally and is what processors expect.
          </Check>
          <Check id="m2-bank">
            Open a dedicated business bank account + card. Never mix personal and
            business money.
          </Check>
          <Check id="m2-tax">
            Set up sales tax: Shopify <em>collects</em> it, <em>you</em> remit
            it. Turn on Shopify Tax and keep filing data from day one.
          </Check>
          <Check id="m2-brand">
            Pick a brandable name (not one product) and buy the matching domain.
          </Check>
          <Check id="m2-tools">
            Create the core free accounts: Shopify, a supplier, Meta Business +
            pixel, Google (Merchant Center, tag, GA4).
          </Check>
          <Avoid>
            <strong>Avoid:</strong> running on a personal Stripe/PayPal with no
            entity, skipping policy pages, or a name so product-specific you
            cannot pivot.
          </Avoid>
          <Resources
            items={[
              ["IRS — apply for an EIN (free)", "https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online"],
              ["SBA — start a business guide", "https://www.sba.gov/business-guide"],
              ["Shopify free tools (name + policy generators)", "https://www.shopify.com/tools"],
              ["Shopify Tax — setup help", "https://help.shopify.com/en/manual/taxes"],
            ]}
          />
        </Module>

        {/* Module 3 */}
        <Module
          id="m3"
          n={3}
          title="Pick your niche"
          master="Choose a market with real demand, healthy margins, and room for repeat buyers."
        >
          <p>
            A niche is the market your store serves (&ldquo;sleep &amp;
            recovery,&rdquo; &ldquo;small-kitchen gadgets,&rdquo; &ldquo;dog
            owners&rdquo;). One niche per store: coherent branding, cheaper ads,
            natural cross-sells. Pick the niche first, then hunt products inside
            it.
          </p>
          <Check id="m3-passion">
            <strong>Active buyers, not just interest</strong> — people already
            spending to solve a problem or feed a hobby.
          </Check>
          <Check id="m3-margin">
            <strong>Room for 3×+ margin</strong> — cheap to source, sells for a
            real multiple (avoid commodities sold everywhere).
          </Check>
          <Check id="m3-repeat">
            <strong>Repeat &amp; expansion potential</strong> — one buyer can buy
            again or buy adjacent products (LTV, module 12).
          </Check>
          <Check id="m3-evergreen">
            <strong>Year-round, broad, ad-friendly</strong> — not a fad, not too
            tiny to reach, not a banned category.
          </Check>
          <KeyIdea>
            The best beginner niches solve a <strong>felt problem</strong> or
            serve a <strong>passion/identity</strong> (pets, hobbies, parenting,
            fitness, home). Emotion sells on cold traffic; pure utility usually
            needs search intent (module 8).
          </KeyIdea>
          <Avoid>
            <strong>Avoid:</strong> hyper-saturated commodities, regulated
            categories (supplements/medical/vaping/weapons), heavy/fragile goods,
            and sized apparel for a <em>first</em> store.
          </Avoid>
          <Resources
            items={[
              ["Google Trends — rising vs dying demand", "https://trends.google.com/trends/"],
              ["Exploding Topics — emerging trends", "https://explodingtopics.com/"],
              ["Shopify blog — finding a niche", "https://www.shopify.com/blog/topics/finding-a-product"],
              ["r/ecommerce — niche discussions", "https://www.reddit.com/r/ecommerce/"],
            ]}
          />
        </Module>

        {/* Module 4 */}
        <Module
          id="m4"
          n={4}
          title="Product research mastery"
          master="A repeatable system to surface winners and kill losers before they cost you anything."
        >
          <p>
            Research is a weekly loop: gather candidates where demand is already
            visible, run them through a hard filter, and let most die on paper.
            The{" "}
            <Link href="/research" className="underline">
              Research
            </Link>{" "}
            pipeline captures, AI-scores, and tracks each idea IDEA → TESTING →
            LIVE/KILLED.
          </p>
          <h3 className="mt-4 text-2xl font-medium text-black dark:text-zinc-50">
            Where to look (demand you can see)
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Meta Ad Library</strong> — #1 signal. An ad running{" "}
              <em>4+ weeks</em> with many variations = someone scaling
              profitably. Read the comments for objections and angles.
            </li>
            <li>
              <strong>TikTok Creative Center</strong> — trending products + the
              creatives that sell them.
            </li>
            <li>
              <strong>Google Trends</strong> — rising vs dying, and seasonality.
            </li>
            <li>
              <strong>AliExpress / Amazon Movers &amp; Shakers</strong> — what is
              already selling in volume.
            </li>
            <li>
              <strong>Competitor stores</strong> — study a winning ad&apos;s
              page, offer, and upsells. Learn mechanics; do not copy the brand.
            </li>
          </ul>
          <h3 className="mt-4 text-2xl font-medium text-black dark:text-zinc-50">
            The 6-point filter (clear all six)
          </h3>
          <Check id="m4-problem">
            <strong>Problem / wow</strong> — solves a felt problem or stops a
            scroll.
          </Check>
          <Check id="m4-margin">
            <strong>3× margin</strong> after shipping (sell ≥ 3× landed cost).
          </Check>
          <Check id="m4-ship">
            <strong>Shippable</strong> — light, unbreakable, no sizing, ≤~12-day
            delivery.
          </Check>
          <Check id="m4-comp">
            <strong>Beatable competition</strong> — demand proof, not big-box
            saturation.
          </Check>
          <Check id="m4-season">
            <strong>Year-round demand</strong> — steady beats a seasonal cliff.
          </Check>
          <Check id="m4-compliance">
            <strong>No compliance landmines</strong> — no ingestibles, medical
            claims, batteries, or trademarks.
          </Check>
          <Tools>
            <strong>In the app:</strong> quick-add candidates (bookmarklet grabs
            title + link), then one-click AI scoring returns a 0–100 score + a
            written rationale across all six criteria. Keep ~70+.
          </Tools>
          <Resources
            items={[
              ["Meta Ad Library — see who's running ads", "https://www.facebook.com/ads/library/"],
              ["TikTok Creative Center — trending products & ads", "https://ads.tiktok.com/business/creativecenter/"],
              ["Google Trends", "https://trends.google.com/trends/"],
              ["Amazon Movers & Shakers — fast risers", "https://www.amazon.com/gp/movers-and-shakers"],
              ["AliExpress (sourcing + bestsellers)", "https://www.aliexpress.com/"],
              ["Ecomhunt — curated winning products (freemium)", "https://www.ecomhunt.com/"],
              ["Sell The Trend — research tool (paid)", "https://www.sellthetrend.com/"],
            ]}
          />
        </Module>

        {/* Module 5 */}
        <Module
          id="m5"
          n={5}
          title="Sourcing & suppliers"
          master="Pick suppliers that ship fast and consistently — the hidden lever behind refunds, reviews, and bans."
        >
          <p>
            Your supplier <em>is</em> your fulfillment, quality control, and
            shipping promise. A cheap supplier with 25-day shipping and flaky
            stock quietly generates the refunds and chargebacks that kill the
            store. Treat supplier choice as a core decision.
          </p>
          <Check id="m5-sample">
            <strong>Order a sample yourself</strong> — judge quality, packaging,
            and real delivery time. Their quality is your reputation.
          </Check>
          <Check id="m5-speed">
            <strong>Prefer US/EU warehouses</strong> or fast lanes — shipping
            speed is the biggest driver of refunds and reviews.
          </Check>
          <Check id="m5-stock">
            <strong>Confirm real, stable stock</strong> and ask about capacity if
            volume spikes.
          </Check>
          <Check id="m5-backup">
            <strong>Line up a backup supplier</strong> for anything you scale.
          </Check>
          <Check id="m5-cogs">
            <strong>Record true landed cost</strong> (unit + shipping) as COGS on
            the{" "}
            <Link href="/stores" className="underline">
              Products tab
            </Link>
            .
          </Check>
          <KeyIdea>
            Negotiate cost only <strong>after</strong> volume is steady — ask
            your supplier or agent (CJ/AutoDS) for a lower unit price and faster
            lane. Free margin.
          </KeyIdea>
          <Tools>
            <strong>In the app:</strong> the fulfillment handoff pushes orders to
            API suppliers and pulls tracking back; manual suppliers get a
            one-click queue on{" "}
            <Link href="/fulfillment" className="underline">
              Fulfillment
            </Link>
            .
          </Tools>
          <Resources
            items={[
              ["CJdropshipping — sourcing + fulfillment", "https://cjdropshipping.com/"],
              ["Spocket — US/EU suppliers", "https://www.spocket.co/"],
              ["AutoDS — automation + sourcing", "https://www.autods.com/"],
              ["DSers — AliExpress order automation (free tier)", "https://www.dsers.com/"],
              ["Zendrop — fast-shipping supplier", "https://zendrop.com/"],
            ]}
          />
        </Module>

        {/* Module 6 */}
        <Module
          id="m6"
          n={6}
          title="A store that converts"
          master="Turn clicks into orders — the conversion work that makes the same ad spend pay off."
        >
          <p>
            Two stores running the identical ad can have double the profit if one
            converts twice as well. Conversion-rate optimization (CRO) is the
            cheapest growth lever you own — no extra ad spend. Aim for fast load,
            instant trust, and zero reasons to hesitate.
          </p>
          <h3 className="mt-4 text-2xl font-medium text-black dark:text-zinc-50">
            The product page (where the sale happens)
          </h3>
          <Check id="m6-images">
            Strong images first: clean shots + lifestyle/in-use photos + a short
            demo video.
          </Check>
          <Check id="m6-benefit">
            Benefit-led copy (problem → outcome), not a spec dump. The AI{" "}
            <Link href="/research" className="underline">
              listing generator
            </Link>{" "}
            drafts this.
          </Check>
          <Check id="m6-trust">
            Trust signals: reviews, clear shipping/returns promise, secure-
            checkout badges, a real support email.
          </Check>
          <Check id="m6-cta">
            One clear CTA and a simple path to checkout — remove distractions.
          </Check>
          <h3 className="mt-4 text-2xl font-medium text-black dark:text-zinc-50">
            The store around it
          </h3>
          <Check id="m6-speed">
            Fast + mobile-first: a clean theme (Dawn is free), compressed images.
            Most traffic is mobile.
          </Check>
          <Check id="m6-policies">
            The four policy pages and honest delivery estimates — required for ad
            approval and trust.
          </Check>
          <Check id="m6-brand">
            Cohesive branding: logo, consistent colors/fonts, a real
            &ldquo;about&rdquo; page.
          </Check>
          <KeyIdea>
            A realistic conversion rate on cold paid traffic is{" "}
            <strong>1–3%</strong>. Below ~1% with traffic flowing, the problem is
            usually the page or the offer (module 7), not the product.
          </KeyIdea>
          <Resources
            items={[
              ["Shopify Theme Store (Dawn is free)", "https://themes.shopify.com/"],
              ["Google PageSpeed Insights — test load speed", "https://pagespeed.web.dev/"],
              ["Baymard Institute — e-commerce UX/CRO research", "https://baymard.com/"],
              ["Shopify Help Center", "https://help.shopify.com/"],
              ["Shopify App Store (reviews, upsells, page builders)", "https://apps.shopify.com/"],
            ]}
          />
        </Module>

        {/* Module 7 */}
        <Module
          id="m7"
          n={7}
          title="Offer, pricing & AOV"
          master="Price for 3×+ margin and engineer a bigger average order — the highest-leverage profit math."
        >
          <p>
            The &ldquo;offer&rdquo; is the whole deal: price, bundle, bonus,
            guarantee, shipping. A better offer beats a better product. And
            because ad cost is mostly fixed per order, raising{" "}
            <strong>average order value (AOV)</strong> drops straight to profit.
          </p>
          <Check id="m7-3x">
            Price at <strong>≥3× landed cost</strong> ($8 → ~$24–30) — the floor
            that leaves room for ads + fees.
          </Check>
          <Check id="m7-anchor">
            Use a compare-at anchor and charm pricing ($29.95 vs $59).
          </Check>
          <Check id="m7-guarantee">
            Add a risk-reverser (money-back / satisfaction guarantee).
          </Check>
          <Check id="m7-bundle">
            Bundles &amp; quantity breaks (&ldquo;buy 2, save 15%&rdquo;).
          </Check>
          <Check id="m7-upsell">
            A one-click post-purchase upsell — pure margin, zero extra ad cost.
          </Check>
          <Check id="m7-freeship">
            A free-shipping threshold just above your current AOV.
          </Check>
          <Example>
            <p className="font-medium text-black dark:text-zinc-50">
              Why AOV is magic
            </p>
            <p>
              Ad cost to get an order is ~$15 whether the cart is $30 or $45. Add
              a $15 upsell that costs you $4 and the order&apos;s profit roughly
              doubles — with no extra ad spend.
            </p>
          </Example>
          <Avoid>
            <strong>Avoid:</strong> competing on price, sub-3× margins, and a
            checkout with no upsell/bundle.
          </Avoid>
          <Resources
            items={[
              ["Shopify blog — increase average order value", "https://www.shopify.com/blog/average-order-value"],
              ["Upsell/bundle apps (Shopify App Store)", "https://apps.shopify.com/categories/marketing-and-conversion-upselling-and-cross-selling"],
              ["Shopify blog — pricing strategy", "https://www.shopify.com/blog/pricing-strategies"],
            ]}
          />
        </Module>

        {/* Module 8 */}
        <Module
          id="m8"
          n={8}
          title="Traffic I — the testing framework"
          master="Get a product in front of real buyers safely: one product, one channel, one variable, a fixed budget."
        >
          <p>
            Paid traffic is the engine. &ldquo;Safe&rdquo; means downside is
            capped and known — you buy <Term>information</Term>, not a bet.
            Dropshipping means no inventory risk: you pay the supplier only after
            a customer pays you.
          </p>
          <h3 className="mt-4 text-2xl font-medium text-black dark:text-zinc-50">
            Channel by product type
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Meta &amp; TikTok</strong> — impulse / wow / problem-aware
              products. You create demand with creative.
            </li>
            <li>
              <strong>Google Shopping / PMax / Search</strong> — things people
              search for. You capture existing intent.
            </li>
          </ul>
          <Check id="m8-pixel">
            Confirm the purchase-conversion event fires (test a real checkout in
            Shopify test mode) <em>before</em> spending.
          </Check>
          <Check id="m8-ready">
            Policies live, support email real, COGS entered, shipping ETAs
            honest.
          </Check>
          <Check id="m8-budget">
            Fixed budget: <strong>$100–150 per product</strong>; plan ~$500–1,500
            of total &ldquo;tuition.&rdquo;
          </Check>
          <Check id="m8-onevar">
            Change one variable at a time so the result teaches you something.
          </Check>
          <Check id="m8-window">
            Give it <strong>3–5 days</strong> (or ~$100–150 spent) before judging.
          </Check>
          <Check id="m8-decide">
            <strong>Kill</strong> with no purchase/strong ATC at budget;{" "}
            <strong>keep</strong> if it clears breakeven ROAS (module 11).
          </Check>
          <KeyIdea>
            Read the funnel: clicks but no add-to-cart = page/offer problem
            (6–7); ATCs but no checkout = price/shipping/trust; no clicks =
            creative/audience (module 9).
          </KeyIdea>
          <Resources
            items={[
              ["Meta Blueprint — free advertising courses", "https://www.facebook.com/business/learn"],
              ["Google Skillshop — free Google Ads training", "https://skillshop.withgoogle.com/"],
              ["TikTok for Business — learning", "https://www.tiktok.com/business/en"],
              ["r/PPC — paid-ads community", "https://www.reddit.com/r/PPC/"],
              ["r/FacebookAds", "https://www.reddit.com/r/FacebookAds/"],
            ]}
          />
        </Module>

        {/* Module 9 */}
        <Module
          id="m9"
          n={9}
          title="Traffic II — winning creative"
          master="The ad creative is ~80% of paid success. Master hooks, angles, and formats that stop the scroll."
        >
          <p>
            On Meta and TikTok the <strong>creative is the targeting</strong> —
            the algorithm finds buyers based on who responds to your video. A
            mediocre product with a great hook beats a great product with a dull
            ad. After product choice, this is the highest-leverage skill here.
          </p>
          <Check id="m9-hook">
            <strong>The hook (first 3 seconds)</strong> — a pattern interrupt:
            the problem shown, a bold claim, &ldquo;you&apos;ve been doing X
            wrong.&rdquo;
          </Check>
          <Check id="m9-angles">
            <strong>Test multiple angles</strong> per product (problem/solution,
            before/after, social proof, founder story, comparison).
          </Check>
          <Check id="m9-ugc">
            <strong>Use UGC-style video</strong> — phone-shot, authentic,
            person-to-camera or demo. Cheap and high-performing on social.
          </Check>
          <Check id="m9-cta">
            <strong>Clear CTA + captions</strong> (most watch muted).
          </Check>
          <Check id="m9-volume">
            Treat creative as volume: ship several new ads/angles weekly —
            winners fatigue.
          </Check>
          <Tools>
            <strong>In the app:</strong> the AI listing generator drafts ad
            angles + Google RSA assets you can adapt as a fast first draft.
          </Tools>
          <Resources
            items={[
              ["TikTok Creative Center — Top Ads & trends", "https://ads.tiktok.com/business/creativecenter/"],
              ["Meta Ad Library — study winning creative", "https://www.facebook.com/ads/library/"],
              ["CapCut — free video editor", "https://www.capcut.com/"],
              ["Billo — UGC creators for ads", "https://billo.app/"],
              ["Fiverr — freelance video/UGC", "https://www.fiverr.com/"],
            ]}
          />
        </Module>

        {/* Module 10 */}
        <Module
          id="m10"
          n={10}
          title="Traffic III — scaling profitably"
          master="Turn a profitable test into an engine without breaking margin or tripping the algorithm."
        >
          <p>
            Only scale a <em>proven</em> winner — one clearing breakeven ROAS with
            room to spare. Scaling a marginal product just loses money faster.
          </p>
          <Check id="m10-vertical">
            <strong>Vertical:</strong> raise budget ~+20–30% every 2–3 days. Big
            jumps reset the algorithm&apos;s learning and spike cost.
          </Check>
          <Check id="m10-horizontal">
            <strong>Horizontal:</strong> duplicate winning ad sets, add
            creatives, test new audiences (lookalikes, broad).
          </Check>
          <Check id="m10-retarget">
            <strong>Add retargeting</strong> — warm audiences (viewers, ATCs,
            buyers) convert cheapest; often your highest-ROAS spend.
          </Check>
          <Check id="m10-cpm">
            Watch ROAS vs breakeven on{" "}
            <Link href="/profit" className="underline">
              Profit
            </Link>{" "}
            — CPMs rise as you spend more.
          </Check>
          <Check id="m10-ops">
            Scale operations too: supplier capacity + backup, faster support, a
            cash float.
          </Check>
          <Tools>
            <strong>In the app:</strong> margin guardrails + the nightly anomaly
            sweep flag cost creep, stockouts, refund spikes, and revenue drops
            before they compound.
          </Tools>
          <Resources
            items={[
              ["Meta Blueprint — scaling & optimization", "https://www.facebook.com/business/learn"],
              ["Google Skillshop — Performance Max", "https://skillshop.withgoogle.com/"],
              ["r/PPC — scaling discussions", "https://www.reddit.com/r/PPC/"],
            ]}
          />
        </Module>

        {/* Module 11 */}
        <Module
          id="m11"
          n={11}
          title="Read the numbers"
          master="The exact metrics that decide kill vs scale — and what 'good' looks like."
        >
          <p>
            This is where most money is won or lost. You need a handful of
            numbers and the discipline to act. The{" "}
            <Link href="/profit" className="underline">
              Profit screen
            </Link>{" "}
            computes them per store and ranks products so the decision is obvious.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Breakeven ROAS</strong> = sell price ÷ profit-before-ads —
              the line every ad must beat.
            </li>
            <li>
              <strong>Contribution margin</strong> = profit per order before ad
              spend — the fuel for traffic.
            </li>
            <li>
              <strong>CAC vs LTV</strong> — cost to acquire vs total profit per
              customer. Win when LTV &gt; CAC, ideally 3×.
            </li>
            <li>
              <strong>Refund rate</strong> per product — quality + processor-risk
              signal.
            </li>
          </ul>
          <Example>
            <p className="font-medium text-black dark:text-zinc-50">
              Worked example
            </p>
            <p>
              Sell at <strong>$30</strong>; cost + shipping + fees = $12; profit-
              before-ads = <strong>$18</strong>. Breakeven ROAS = 30 ÷ 18 ≈{" "}
              <strong>1.67×</strong>. At 2.5× you net ~$12/order and scale; stuck
              at 1.4× you lose ~$3/order — kill or fix the offer.
            </p>
          </Example>
          <Check id="m11-spend">
            Enter daily ad spend (manual or CSV) so ROAS is real.
          </Check>
          <Check id="m11-breakeven">
            Know each product&apos;s breakeven ROAS; check actual ROAS against it
            every decision.
          </Check>
          <Check id="m11-review">
            Read the{" "}
            <Link href="/reviews" className="underline">
              weekly AI review
            </Link>{" "}
            for scale/kill/anomalies.
          </Check>
          <Resources
            items={[
              ["Shopify blog — break-even ROAS explained", "https://www.shopify.com/blog/roas"],
              ["Shopify profit-margin calculator", "https://www.shopify.com/tools/profit-margin-calculator"],
              ["r/PPC — metrics & measurement", "https://www.reddit.com/r/PPC/"],
            ]}
          />
        </Module>

        {/* Module 12 */}
        <Module
          id="m12"
          n={12}
          title="Retention & LTV"
          master="Earn the second and third sale — the profit that needs no ad spend and makes scaling sustainable."
        >
          <p>
            Acquisition is expensive; a customer you already paid for is nearly
            free to sell again. Email/SMS and a reviews loop turn one-time buyers
            into repeat profit — and higher LTV lets you outbid competitors on
            ads.
          </p>
          <Check id="m12-abandon">
            <strong>Abandoned-cart</strong> flow — recovers sales one hesitation
            away. Usually the highest-ROI automation you can build.
          </Check>
          <Check id="m12-welcome">
            <strong>Welcome / first-purchase</strong> flow with a small
            incentive.
          </Check>
          <Check id="m12-postpurchase">
            <strong>Post-purchase</strong> flow — shipping updates, how-to-use, a
            cross-sell once they&apos;re happy.
          </Check>
          <Check id="m12-winback">
            <strong>Win-back</strong> flow for lapsed buyers.
          </Check>
          <Check id="m12-reviews">
            Request reviews/photos after delivery; show them on the page (feeds
            module 6 trust + gives free UGC for module 9).
          </Check>
          <Check id="m12-list">
            Treat your email/SMS list as an owned asset — traffic you don&apos;t
            rent, and a cushion against rising ad costs.
          </Check>
          <Resources
            items={[
              ["Klaviyo — email/SMS (free tier)", "https://www.klaviyo.com/"],
              ["Klaviyo Academy — free flow courses", "https://academy.klaviyo.com/"],
              ["Judge.me — product reviews (free tier)", "https://judge.me/"],
              ["Loox — photo reviews", "https://loox.com/"],
            ]}
          />
        </Module>

        {/* Module 13 */}
        <Module
          id="m13"
          n={13}
          title="Operations & customer service"
          master="Fast fulfillment and great support — the unglamorous work that protects margin and your processor."
        >
          <p>
            Operations is where reputation is made or lost. Late shipments and
            slow replies become refunds and chargebacks; chargebacks past ~1%
            threaten your ability to take payment at all.
          </p>
          <Check id="m13-fast">
            Place supplier orders promptly + capture tracking — work the{" "}
            <Link href="/fulfillment" className="underline">
              fulfillment queue
            </Link>{" "}
            daily.
          </Check>
          <Check id="m13-proactive">
            Set honest delivery expectations and send proactive shipping
            updates — silence causes most &ldquo;where is my order&rdquo;
            tickets.
          </Check>
          <Check id="m13-sla">
            Reply fast (aim &lt;24h) with a real support email — speed defuses
            most refund/chargeback threats.
          </Check>
          <Check id="m13-refunds">
            Keep a simple, generous-enough refund/replacement policy. A cheap
            refund beats a chargeback.
          </Check>
          <Check id="m13-chargebacks">
            Track refund rate per product on{" "}
            <Link href="/alerts" className="underline">
              Alerts
            </Link>
            ; investigate spikes immediately.
          </Check>
          <KeyIdea>
            A $5 proactive refund/reship protects a $30 order, a ~$15 chargeback
            fee, and your processor standing. Generosity on small disputes is
            almost always the profitable move.
          </KeyIdea>
          <Resources
            items={[
              ["Shopify — manage shipping & fulfillment", "https://help.shopify.com/en/manual/fulfillment"],
              ["Stripe — how disputes & chargebacks work", "https://stripe.com/resources/more/chargebacks-explained"],
              ["Gorgias — e-commerce helpdesk", "https://www.gorgias.com/"],
            ]}
          />
        </Module>

        {/* Module 14 */}
        <Module
          id="m14"
          n={14}
          title="Risk & survival"
          master="The threats that end stores overnight — ad bans, payment holds, cash crunches — and how to survive them."
        >
          <p>
            Most stores die not from bad products but from a banned ad account, a
            frozen processor, or running out of cash mid-scale. Build redundancy
            before you need it.
          </p>
          <Check id="m14-compliant">
            Stay policy-compliant: accurate claims (no &ldquo;cures,&rdquo; no
            fake urgency), allowed products, a complete trustworthy store.
          </Check>
          <Check id="m14-warmup">
            Warm accounts up and scale spend gradually — sudden 10× jumps trigger
            reviews.
          </Check>
          <Check id="m14-chargeback">
            Keep chargebacks under ~1% — the line between an operating business
            and a frozen one.
          </Check>
          <Check id="m14-backup-pay">
            Have a backup payment path; keep payouts flowing to your business
            bank.
          </Check>
          <Check id="m14-float">
            Hold a cash float before scaling — ads/suppliers charge now, Shopify
            pays in 2–3 days, refunds claw back.
          </Check>
          <Check id="m14-reinvest">
            Reinvest deliberately: a fixed owner&apos;s draw, a reserve, the rest
            into tested winners. Do not spend un-banked profit.
          </Check>
          <Resources
            items={[
              ["Meta Advertising Standards (policies)", "https://transparency.meta.com/policies/ad-standards/"],
              ["Google Ads policies", "https://support.google.com/adspolicy/answer/6008942"],
              ["TikTok advertising policies", "https://ads.tiktok.com/help/article/tiktok-advertising-policies-industry-entry"],
              ["USPTO — trademark search (avoid infringement)", "https://www.uspto.gov/trademarks/search"],
            ]}
          />
        </Module>

        {/* Module 15 */}
        <Module
          id="m15"
          n={15}
          title="Build the portfolio"
          master="Turn one proven store into several — the endgame, and the only safe way to multiply."
        >
          <p>
            Once a store is <em>consistently</em> profitable and operationally
            calm, template it and clone. A portfolio of profitable stores is the
            goal — but only profitable ones.
          </p>
          <Check id="m15-template">
            Document the winning playbook (niche logic, store template, supplier,
            angles, KPIs) and instantiate store #2 with the same{" "}
            <Link href="/stores" className="underline">
              Launch checklist
            </Link>
            . One niche per store.
          </Check>
          <Check id="m15-reuse">
            Reuse the research rubric and creative patterns across stores.
          </Check>
          <Check id="m15-portfolio">
            Run everything from the{" "}
            <Link href="/" className="underline">
              Portfolio dashboard
            </Link>{" "}
            and the cross-store weekly review.
          </Check>
          <Check id="m15-delegate">
            Delegate repeatable work: give a VA a fulfillment-only login (see{" "}
            <Link href="/fulfillment" className="underline">
              Fulfillment
            </Link>
            ).
          </Check>
          <Check id="m15-prune">
            Prune ruthlessly — kill underperformers fast.
          </Check>
          <KeyIdea>
            The discipline that makes a portfolio work is module 1: clone only{" "}
            <strong>proven</strong> systems. Never open store #2 to escape a
            store #1 that is not yet profitable.
          </KeyIdea>
          <Resources
            items={[
              ["Shopify blog — scaling your business", "https://www.shopify.com/blog/topics/grow-your-business"],
              ["r/ecommerce — operators scaling up", "https://www.reddit.com/r/ecommerce/"],
            ]}
          />
        </Module>

        {/* Cadence */}
        <Section id="cadence" title="Your operating cadence">
          <p>The course is the &ldquo;what.&rdquo; This is the rhythm.</p>
          <h3 className="mt-3 text-2xl font-medium text-black dark:text-zinc-50">
            Daily (5–10 min)
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Glance the{" "}
              <Link href="/" className="underline">
                dashboard
              </Link>
              ; clear{" "}
              <Link href="/alerts" className="underline">
                Alerts
              </Link>
              ; work the{" "}
              <Link href="/fulfillment" className="underline">
                fulfillment queue
              </Link>
              .
            </li>
            <li>Enter yesterday&apos;s ad spend; answer support.</li>
          </ul>
          <h3 className="mt-4 text-2xl font-medium text-black dark:text-zinc-50">
            Weekly (30–60 min)
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Read the{" "}
              <Link href="/reviews" className="underline">
                weekly review
              </Link>
              ; scale winners, kill losers.
            </li>
            <li>Score new research; ship new creatives/angles.</li>
            <li>Reconcile ad spend vs the platforms.</li>
          </ul>
          <h3 className="mt-4 text-2xl font-medium text-black dark:text-zinc-50">
            Monthly
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Remit sales tax; reconcile payouts; take your owner&apos;s draw.</li>
            <li>Review supplier quality + refund trends; renegotiate cost.</li>
            <li>Decide whether a winner is stable enough to template store #2.</li>
          </ul>
        </Section>

        {/* Mistakes */}
        <Section id="mistakes" title="Top mistakes that sink beginners">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Tracking revenue, not profit.</strong> (Module 11.)
            </li>
            <li>
              <strong>Scaling too early / too fast.</strong> (Modules 10–11.)
            </li>
            <li>
              <strong>Sub-3× margins.</strong> (Modules 4, 7.)
            </li>
            <li>
              <strong>Slow shipping / bad supplier.</strong> (Module 5.)
            </li>
            <li>
              <strong>Weak creative / one ad.</strong> (Module 9.)
            </li>
            <li>
              <strong>Ignoring CRO.</strong> (Module 6.)
            </li>
            <li>
              <strong>No retention.</strong> (Module 12.)
            </li>
            <li>
              <strong>No redundancy / no cash float.</strong> (Module 14.)
            </li>
            <li>
              <strong>Emotional decisions.</strong> (Module 1.)
            </li>
            <li>
              <strong>Opening store #2 to escape store #1.</strong> (Module 15.)
            </li>
          </ol>
        </Section>

        {/* KPI targets */}
        <Section id="kpis" title="KPI targets (rules of thumb)">
          <p>
            Directional benchmarks for a healthy store — not laws, but if
            you&apos;re far off, look there first.
          </p>
          <div className="overflow-hidden rounded-xl border border-black/[.08] dark:border-white/[.145]">
            <table className="w-full text-left text-lg">
              <thead className="bg-zinc-50 text-base uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Metric</th>
                  <th className="px-4 py-2 font-medium">Healthy target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                <Kpi metric="Markup (price ÷ landed cost)" target="≥ 3×" />
                <Kpi metric="Gross margin per order" target="≥ 65–70%" />
                <Kpi metric="Conversion rate (cold paid traffic)" target="1–3%" />
                <Kpi metric="ROAS vs breakeven" target="Above breakeven; ≥ ~2× is strong" />
                <Kpi metric="LTV ÷ CAC" target="≥ 3×" />
                <Kpi metric="Refund rate" target="< 5% (investigate spikes)" />
                <Kpi metric="Chargeback rate" target="< 1% (hard ceiling)" />
                <Kpi metric="Test budget per product" target="$100–150" />
                <Kpi metric="Delivery time" target="≤ ~12 days (faster is better)" />
              </tbody>
            </table>
          </div>
        </Section>

        {/* Resource library */}
        <Section id="library" title="Resource library (all in one place)">
          <p>
            The outside resources from every module, grouped. Third-party sites —
            free unless noted; start with free and only pay when a free tool
            stops being enough.
          </p>
          <ResourceGroup
            title="Product & market research"
            items={[
              ["Meta Ad Library", "https://www.facebook.com/ads/library/"],
              ["TikTok Creative Center", "https://ads.tiktok.com/business/creativecenter/"],
              ["Google Trends", "https://trends.google.com/trends/"],
              ["Exploding Topics", "https://explodingtopics.com/"],
              ["Amazon Movers & Shakers", "https://www.amazon.com/gp/movers-and-shakers"],
              ["Ecomhunt (freemium)", "https://www.ecomhunt.com/"],
              ["Sell The Trend (paid)", "https://www.sellthetrend.com/"],
            ]}
          />
          <ResourceGroup
            title="Suppliers & fulfillment"
            items={[
              ["CJdropshipping", "https://cjdropshipping.com/"],
              ["Spocket (US/EU)", "https://www.spocket.co/"],
              ["AutoDS", "https://www.autods.com/"],
              ["DSers (free tier)", "https://www.dsers.com/"],
              ["Zendrop", "https://zendrop.com/"],
            ]}
          />
          <ResourceGroup
            title="Store, CRO & apps"
            items={[
              ["Shopify Theme Store", "https://themes.shopify.com/"],
              ["Shopify App Store", "https://apps.shopify.com/"],
              ["Google PageSpeed Insights", "https://pagespeed.web.dev/"],
              ["Baymard Institute (UX research)", "https://baymard.com/"],
              ["Shopify Help Center", "https://help.shopify.com/"],
            ]}
          />
          <ResourceGroup
            title="Ads & creative (free training)"
            items={[
              ["Meta Blueprint", "https://www.facebook.com/business/learn"],
              ["Google Skillshop", "https://skillshop.withgoogle.com/"],
              ["TikTok for Business", "https://www.tiktok.com/business/en"],
              ["CapCut (free editor)", "https://www.capcut.com/"],
              ["Billo (UGC creators)", "https://billo.app/"],
            ]}
          />
          <ResourceGroup
            title="Retention & support"
            items={[
              ["Klaviyo + Academy", "https://academy.klaviyo.com/"],
              ["Judge.me (reviews)", "https://judge.me/"],
              ["Loox (photo reviews)", "https://loox.com/"],
              ["Gorgias (helpdesk)", "https://www.gorgias.com/"],
            ]}
          />
          <ResourceGroup
            title="Policies, legal & communities"
            items={[
              ["IRS — EIN", "https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online"],
              ["USPTO — trademark search", "https://www.uspto.gov/trademarks/search"],
              ["Meta ad standards", "https://transparency.meta.com/policies/ad-standards/"],
              ["Google Ads policies", "https://support.google.com/adspolicy/answer/6008942"],
              ["r/dropship", "https://www.reddit.com/r/dropship/"],
              ["r/ecommerce", "https://www.reddit.com/r/ecommerce/"],
              ["r/PPC", "https://www.reddit.com/r/PPC/"],
            ]}
          />
        </Section>

        {/* Roadmap */}
        <Section id="roadmap" title="Roadmap — what gets built next">
          <p>
            New capabilities unlock as you hit milestones — deliberately. Some
            need a live, profitable store and real ad/supplier accounts to build
            and verify against.
          </p>
          <Milestone status="done" when="Recently shipped">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Anomaly detection</strong> — nightly refund-spike and
                revenue-drop alerts vs a trailing baseline.
              </li>
              <li>
                <strong>VA role</strong> — an optional assistant login limited to
                the fulfillment queue.
              </li>
            </ul>
          </Milestone>
          <Milestone status="next" when="Milestone: store #1 consistently profitable">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Google Ads &amp; Meta Ads APIs</strong> — pull real spend
                + conversions automatically (ends manual ad-spend entry). Gated
                on live ad accounts.
              </li>
            </ul>
          </Milestone>
          <Milestone status="later" when="Milestone: 2–3 profitable stores / more volume">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Supplier auto-routing</strong>,{" "}
                <strong>WooCommerce adapter</strong>, and a{" "}
                <strong>scheduled research agent</strong>.
              </li>
            </ul>
          </Milestone>
          <Milestone status="later" when="Quality-of-life, any time">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Phone push notifications</strong> and{" "}
                <strong>expanded VA/support views</strong>.
              </li>
            </ul>
          </Milestone>
        </Section>

        {/* Screens */}
        <Section id="screens" title="Every screen, and the decision it supports">
          <ScreenRef href="/" name="Portfolio (dashboard)">
            Combined + per-store revenue, order counts, sync status, the revenue
            chart. Your morning glance.
          </ScreenRef>
          <ScreenRef href="/stores" name="Stores">
            Connect a Shopify store. Per-store tabs: Orders, Products (inline
            COGS), Ads (spend entry/CSV), Launch (go-live checklist).
          </ScreenRef>
          <ScreenRef href="/research" name="Research">
            The idea pipeline: capture, AI-score, move IDEA → TESTING →
            LIVE/KILLED, generate listing copy.
          </ScreenRef>
          <ScreenRef href="/profit" name="Profit">
            The truth screen: profit/margin/ROAS vs breakeven + a profit-ranked
            kill/scale list.
          </ScreenRef>
          <ScreenRef href="/reviews" name="Review">
            The weekly AI portfolio review — scale/kill/anomalies — saved and
            emailed.
          </ScreenRef>
          <ScreenRef href="/alerts" name="Alerts">
            Margin breaches, stockouts, refund/revenue anomalies, sync failures.
          </ScreenRef>
          <ScreenRef href="/fulfillment" name="Fulfillment">
            The queue of orders to place with suppliers; tracking flows back. A VA
            can be limited to just this.
          </ScreenRef>
          <ScreenRef href="/sync" name="Sync health">
            A log of every sync run — where you look when a store goes red.
          </ScreenRef>
        </Section>

        {/* Glossary */}
        <Section id="glossary" title="Glossary">
          <dl className="space-y-3">
            <Def term="COGS">
              Cost of goods sold — supplier product cost plus their shipping. Your
              landed cost.
            </Def>
            <Def term="AOV">
              Average order value. Raising it (bundles/upsells) is the cheapest
              profit lever.
            </Def>
            <Def term="ROAS">
              Return on ad spend = revenue ÷ ad spend.
            </Def>
            <Def term="Breakeven ROAS">
              The ROAS where ads exactly pay for themselves (sell price ÷
              profit-before-ads). Scale above it, kill below it.
            </Def>
            <Def term="Contribution margin">
              Profit per order before ad spend — the fuel each sale gives you to
              buy traffic.
            </Def>
            <Def term="CAC / LTV">
              Cost to acquire a customer / total profit from them over time. Win
              when LTV &gt; CAC, ideally 3×.
            </Def>
            <Def term="CRO">
              Conversion-rate optimization — making the same traffic buy more
              often (module 6).
            </Def>
            <Def term="UGC">
              User-generated-content-style ads — authentic, phone-shot video.
            </Def>
            <Def term="Hook">
              The first ~3 seconds of an ad — the pattern interrupt that decides
              whether anyone keeps watching.
            </Def>
            <Def term="Chargeback">
              A customer disputes a charge with their bank. Keep under ~1% or
              processors drop you.
            </Def>
            <Def term="Pixel / tag">
              Tracking code that reports purchases to ad platforms so they
              optimize. Install before spending.
            </Def>
            <Def term="Worker">
              The background process that runs scheduled jobs (rollups,
              guardrails, anomaly sweep, weekly review).
            </Def>
          </dl>
        </Section>

        <p className="mt-12 border-t border-zinc-200 pt-6 text-lg text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          One store until it works. Make store #1 profitable, template what
          worked, then clone. The system wins on process — not on any single bet.
        </p>
      </div>
    </ProgressProvider>
  );
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-20">
      <h2 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-xl leading-8 text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}

function Module({
  id,
  n,
  title,
  master,
  children,
}: {
  id: string;
  n: number;
  title: string;
  master: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <div className="rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div>
            <div className="text-base font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Module {n}
            </div>
            <h2 className="mt-0.5 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
              {title}
            </h2>
            <p className="mt-1 text-lg text-zinc-500 dark:text-zinc-400">
              <strong>Master:</strong> {master}
            </p>
          </div>
          <span
            className={`mt-1 shrink-0 text-zinc-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            ▾
          </span>
        </button>
        {open && (
          <div className="mt-4 space-y-3 text-xl leading-8 text-zinc-700 dark:text-zinc-300">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

function KeyIdea({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-lg leading-7 text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
      <span className="mr-1 font-semibold">Key idea — </span>
      {children}
    </div>
  );
}

function Avoid({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-lg leading-7 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
      {children}
    </div>
  );
}

function Tools({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-lg leading-7 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
      {children}
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-lg text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      {children}
    </div>
  );
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-lg dark:border-zinc-800 dark:bg-zinc-900/50">
      {children}
    </div>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-zinc-100 px-4 py-3 text-center font-mono text-lg text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
      {children}
    </div>
  );
}

/** A box of external "learn more" links. items = [label, href][]. */
function Resources({ items }: { items: [string, string][] }) {
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900/50 dark:bg-sky-950/30">
      <div className="mb-1 text-base font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
        Learn more
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-lg">
        {items.map(([label, href]) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-700 underline hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResourceGroup({
  title,
  items,
}: {
  title: string;
  items: [string, string][];
}) {
  return (
    <div>
      <h3 className="mt-4 text-2xl font-medium text-black dark:text-zinc-50">
        {title}
      </h3>
      <Resources items={items} />
    </div>
  );
}

function Milestone({
  status,
  when,
  children,
}: {
  status: "done" | "next" | "later";
  when: string;
  children: React.ReactNode;
}) {
  const badge =
    status === "done"
      ? { label: "Shipped", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" }
      : status === "next"
        ? { label: "Next", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" }
        : { label: "Later", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" };
  return (
    <div className="rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-base font-medium ${badge.cls}`}>
          {badge.label}
        </span>
        <span className="font-medium text-black dark:text-zinc-50">{when}</span>
      </div>
      <div className="mt-2 space-y-2 text-lg leading-7 text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </div>
  );
}

function ScreenRef({
  href,
  name,
  children,
}: {
  href: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-zinc-100 py-3 last:border-0 dark:border-zinc-900">
      <Link href={href} className="font-medium text-black hover:underline dark:text-zinc-50">
        {name}
      </Link>
      <p className="mt-0.5 text-lg text-zinc-600 dark:text-zinc-400">{children}</p>
    </div>
  );
}

function Def({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-black dark:text-zinc-50">{term}</dt>
      <dd className="text-lg text-zinc-600 dark:text-zinc-400">{children}</dd>
    </div>
  );
}

function Kpi({ metric, target }: { metric: string; target: string }) {
  return (
    <tr>
      <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{metric}</td>
      <td className="px-4 py-2 font-medium text-black dark:text-zinc-50">{target}</td>
    </tr>
  );
}

function Term({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-medium text-black dark:text-zinc-50">{children}</span>
  );
}
