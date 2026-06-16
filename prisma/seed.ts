// Load .env before importing lib/db (which reads DATABASE_URL at module init).
import "dotenv/config";

import { prisma } from "../lib/db";
import { rebuildRecentDailyMetrics } from "../lib/profit/rollup";

/**
 * Seed a realistic, clearly-profitable demo portfolio so the app looks like a
 * healthy multi-store operation in development. Idempotent: wipes all existing
 * (dummy) stores/suppliers/research/alerts and rebuilds from scratch, then runs
 * the DailyMetric rollup so the Profit screen is populated immediately.
 *
 * All money is integer cents (CLAUDE.md rule 4). Tuned so blended ROAS sits
 * comfortably above breakeven and net margin lands in a believable ~20–28%.
 */

const WINDOW_DAYS = 60;

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
function pickSome<T>(items: T[], n: number): T[] {
  return [...items].sort(() => Math.random() - 0.5).slice(0, n);
}

interface Spec {
  title: string;
  niche: string;
  costCents: number;
  shipCostCents: number;
  priceCents: number;
  compareAtCents: number;
  researchScore: number;
}

const STORES: { name: string; domain: string; products: Spec[] }[] = [
  {
    name: "VitalEdge",
    domain: "vitaledge-demo.myshopify.com",
    products: [
      { title: "Posture Corrector Pro", niche: "Health", costCents: 480, shipCostCents: 220, priceCents: 2999, compareAtCents: 4999, researchScore: 84 },
      { title: "Cordless Neck Massager", niche: "Health", costCents: 1100, shipCostCents: 400, priceCents: 4999, compareAtCents: 7999, researchScore: 78 },
      { title: "Acupressure Mat & Pillow Set", niche: "Health", costCents: 700, shipCostCents: 300, priceCents: 3499, compareAtCents: 5999, researchScore: 80 },
      { title: "Red Light Therapy Wand", niche: "Health", costCents: 1400, shipCostCents: 400, priceCents: 5999, compareAtCents: 8999, researchScore: 74 },
      { title: "Resistance Band Kit", niche: "Fitness", costCents: 350, shipCostCents: 200, priceCents: 2499, compareAtCents: 3999, researchScore: 72 },
    ],
  },
  {
    name: "LumaNest",
    domain: "lumanest-demo.myshopify.com",
    products: [
      { title: "LED Galaxy Projector", niche: "Home", costCents: 1150, shipCostCents: 350, priceCents: 3999, compareAtCents: 5999, researchScore: 81 },
      { title: "Sunset Lamp Projector", niche: "Home", costCents: 650, shipCostCents: 250, priceCents: 2999, compareAtCents: 4499, researchScore: 77 },
      { title: "Levitating Moon Lamp", niche: "Home", costCents: 1300, shipCostCents: 400, priceCents: 5499, compareAtCents: 7999, researchScore: 76 },
      { title: "Aroma Diffuser + Mood Light", niche: "Home", costCents: 800, shipCostCents: 300, priceCents: 3499, compareAtCents: 4999, researchScore: 73 },
      { title: "Cloud Ceiling Light", niche: "Home", costCents: 1500, shipCostCents: 450, priceCents: 5999, compareAtCents: 8999, researchScore: 70 },
    ],
  },
  {
    name: "PawPalace",
    domain: "pawpalace-demo.myshopify.com",
    products: [
      { title: "Pet Hair Remover Roller", niche: "Pets", costCents: 410, shipCostCents: 210, priceCents: 2499, compareAtCents: 3499, researchScore: 82 },
      { title: "Self-Cleaning Slicker Brush", niche: "Pets", costCents: 520, shipCostCents: 230, priceCents: 2699, compareAtCents: 3999, researchScore: 79 },
      { title: "Calming Donut Dog Bed", niche: "Pets", costCents: 1400, shipCostCents: 600, priceCents: 5999, compareAtCents: 8999, researchScore: 75 },
      { title: "Interactive Treat Puzzle", niche: "Pets", costCents: 600, shipCostCents: 280, priceCents: 2999, compareAtCents: 3999, researchScore: 71 },
      { title: "LED Safety Dog Collar", niche: "Pets", costCents: 380, shipCostCents: 200, priceCents: 2299, compareAtCents: 2999, researchScore: 69 },
    ],
  },
];

/** Orders for a given day-offset: grows toward the present, with mild noise. */
function ordersForDay(dayOffset: number): number {
  const progress = 1 - dayOffset / WINDOW_DAYS; // 0 (oldest) → 1 (today)
  const base = 4 + 12 * progress; // ~4/day early → ~16/day recent
  const weekendBoost = [0, 6].includes((dayOffset + 6) % 7) ? 1.15 : 1; // light weekly wave
  return Math.max(1, Math.round(base * weekendBoost + rand(-2, 2)));
}

async function main() {
  console.log("Wiping existing demo data...");
  await prisma.alert.deleteMany({});
  await prisma.researchItem.deleteMany({});
  await prisma.store.deleteMany({}); // cascades products/orders/items/adSpend/syncLogs/dailyMetrics/fulfillment
  await prisma.supplier.deleteMany({});

  const supplier = await prisma.supplier.create({
    data: { name: "AutoDS (US/EU warehouses)", type: "AUTODS", notes: "Primary demo supplier." },
  });

  const now = new Date();
  let orderNo = 1000;

  for (const sConf of STORES) {
    const store = await prisma.store.create({
      data: {
        name: sConf.name,
        platform: "SHOPIFY",
        shopDomain: sConf.domain,
        accessTokenEnc: "demo::not-a-real-encrypted-token",
        status: "ACTIVE",
        currency: "USD",
      },
    });

    const products = [];
    for (let i = 0; i < sConf.products.length; i++) {
      const p = sConf.products[i];
      products.push(
        await prisma.product.create({
          data: {
            storeId: store.id,
            supplierId: supplier.id,
            shopifyProductId: `${sConf.name.toLowerCase()}-prod-${i + 1}`,
            title: p.title,
            status: "ACTIVE",
            niche: p.niche,
            costCents: p.costCents,
            shipCostCents: p.shipCostCents,
            priceCents: p.priceCents,
            compareAtCents: p.compareAtCents,
            researchScore: p.researchScore,
          },
        }),
      );
    }

    // Orders + per-day revenue, then ad spend tuned to that revenue.
    for (let d = WINDOW_DAYS - 1; d >= 0; d--) {
      let dayRevenue = 0;
      const count = ordersForDay(d);

      for (let k = 0; k < count; k++) {
        orderNo++;
        const placedAt = new Date(now);
        placedAt.setDate(now.getDate() - d);
        placedAt.setHours(randInt(8, 21), randInt(0, 59), 0, 0);

        const lineItems = pickSome(products, randInt(1, 3)).map((p) => ({
          productId: p.id,
          qty: randInt(1, 2),
          priceCents: p.priceCents,
          costCents: p.costCents + p.shipCostCents,
        }));
        const revenueCents = lineItems.reduce((s, li) => s + li.priceCents * li.qty, 0);
        dayRevenue += revenueCents;

        // ~4% of orders get a partial refund (one item's price).
        const refunded = Math.random() < 0.04;
        const refundCents = refunded ? lineItems[0].priceCents : 0;

        await prisma.order.create({
          data: {
            storeId: store.id,
            shopifyOrderId: `demo-order-${orderNo}`,
            orderNumber: `#${orderNo}`,
            placedAt,
            financialStatus: refunded ? "partially_refunded" : "paid",
            fulfillmentStatus: d > 2 ? "fulfilled" : Math.random() > 0.4 ? "fulfilled" : null,
            customerEmail: `customer${orderNo}@example.com`,
            revenueCents,
            shippingChargedCents: 0,
            taxCents: Math.round(revenueCents * 0.07),
            refundCents,
            currency: "USD",
            items: { create: lineItems },
          },
        });
      }

      // Ad spend ≈ 36–42% of the day's revenue → blended ROAS ~2.4–2.8×.
      const date = new Date(now);
      date.setDate(now.getDate() - d);
      date.setHours(0, 0, 0, 0);
      const daySpend = Math.round(dayRevenue * rand(0.36, 0.42));
      const metaSpend = Math.round(daySpend * 0.55);
      const googleSpend = daySpend - metaSpend;

      for (const [channel, spendCents, campaign] of [
        ["META", metaSpend, "Advantage+ Shopping"],
        ["GOOGLE", googleSpend, "Performance Max"],
      ] as const) {
        if (spendCents <= 0) continue;
        const clicks = Math.max(1, Math.round(spendCents / randInt(70, 110)));
        await prisma.adSpend.create({
          data: {
            storeId: store.id,
            date,
            channel,
            campaignName: campaign,
            spendCents,
            clicks,
            impressions: clicks * randInt(25, 55),
            conversions: Math.max(0, Math.round(clicks * rand(0.03, 0.06))),
          },
        });
      }
    }

    // A few recent green syncs.
    for (const kind of ["ORDERS", "PRODUCTS"] as const) {
      const startedAt = new Date(now);
      startedAt.setMinutes(now.getMinutes() - randInt(5, 90));
      await prisma.syncLog.create({
        data: { storeId: store.id, kind, startedAt, finishedAt: new Date(startedAt.getTime() + 4000), ok: true, itemsTouched: randInt(20, 120) },
      });
    }

    // A couple of low/info alerts, mostly already read (nothing alarming).
    await prisma.alert.createMany({
      data: [
        { storeId: store.id, severity: "LOW", kind: "SYNC_OK", message: `${sConf.name}: nightly order sync completed successfully.`, readAt: new Date() },
        { storeId: store.id, severity: "MEDIUM", kind: "INFO", message: `${sConf.name}: a top product is trending up — consider raising budget.` },
      ],
    });
  }

  // Research pipeline (cross-store + per-store).
  const firstStore = await prisma.store.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  await prisma.researchItem.createMany({
    data: [
      { title: "Magnetic Knife Strip", niche: "Kitchen", supplierCostCents: 520, estPriceCents: 2499, score: 76, scoreRationale: "Solves clutter, ~3.4x margin, light and unbreakable. Worth a test.", status: "TESTING", storeId: firstStore?.id ?? null },
      { title: "Heated Eye Massager", niche: "Health", supplierCostCents: 1600, estPriceCents: 5999, score: 71, scoreRationale: "Strong wow factor and margin, but battery/electrical — check ad compliance.", status: "TESTING", storeId: firstStore?.id ?? null },
      { title: "Car Seat Gap Filler", niche: "Auto", supplierCostCents: 240, estPriceCents: 1799, score: 68, scoreRationale: "Cheap, real problem; low wow — best as a bundle add-on.", status: "IDEA" },
      { title: "Collapsible Dog Bowl", niche: "Pets", supplierCostCents: 180, estPriceCents: 1499, score: 55, scoreRationale: "Commoditized, low margin after ads. Pass for now.", status: "KILLED" },
    ],
  });

  console.log("Rebuilding daily metrics (profit rollup)...");
  const roll = await rebuildRecentDailyMetrics(WINDOW_DAYS + 2, now);

  const counts = {
    stores: await prisma.store.count(),
    products: await prisma.product.count(),
    orders: await prisma.order.count(),
    adSpend: await prisma.adSpend.count(),
    research: await prisma.researchItem.count(),
    alerts: await prisma.alert.count(),
    dailyMetricRows: roll.rowsWritten,
  };
  console.log("Seed complete:", counts);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
