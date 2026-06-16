import { describe, it, expect } from "vitest";

import {
  breakevenRoas,
  computeOrderProfit,
  marginRatioPct,
  paymentFeeCents,
  roas,
  rollupDay,
  type PaymentFeeConfig,
  type RollupOrder,
} from "../../lib/profit/profit";

const FEE: PaymentFeeConfig = { percent: 2.9, fixedCents: 30 };

describe("payment fee", () => {
  it("is percent of income plus the fixed cents", () => {
    // $29.99 × 2.9% = 86.97¢ → 87, + 30 = 117
    expect(paymentFeeCents(2999, FEE)).toBe(117);
    expect(paymentFeeCents(0, FEE)).toBe(30);
  });
});

describe("computeOrderProfit (golden cases)", () => {
  it("single product, free shipping, no refund", () => {
    const p = computeOrderProfit(
      {
        revenueCents: 2999,
        shippingChargedCents: 0,
        productCostCents: 700,
        refundCents: 0,
      },
      FEE,
    );
    expect(p.incomeCents).toBe(2999);
    expect(p.paymentFeesCents).toBe(117);
    expect(p.profitCents).toBe(2182); // 2999 - 700 - 117
    expect(p.marginPct).toBeCloseTo(72.76, 1);
  });

  it("counts charged shipping as income and refunds against profit", () => {
    const p = computeOrderProfit(
      {
        revenueCents: 4000,
        shippingChargedCents: 500,
        productCostCents: 1500,
        refundCents: 1000,
      },
      FEE,
    );
    // income 4500; fee = round(4500*.029)=131 +30 = 161
    expect(p.incomeCents).toBe(4500);
    expect(p.paymentFeesCents).toBe(161);
    expect(p.profitCents).toBe(4500 - 1500 - 161 - 1000); // 1839
  });

  it("reports null margin when there is no income", () => {
    const p = computeOrderProfit(
      { revenueCents: 0, shippingChargedCents: 0, productCostCents: 0, refundCents: 0 },
      FEE,
    );
    expect(p.marginPct).toBeNull();
  });
});

describe("profit ratios", () => {
  it("computes margin, ROAS, and breakeven ROAS", () => {
    expect(marginRatioPct(2000, 10000)).toBe(20);
    expect(marginRatioPct(0, 0)).toBeNull();

    expect(roas(30000, 10000)).toBe(3); // $300 rev / $100 spend
    expect(roas(30000, 0)).toBeNull();

    // contribution margin 50% → must earn $2 revenue per $1 ad spend
    expect(breakevenRoas(5000, 10000)).toBe(2);
    expect(breakevenRoas(0, 10000)).toBeNull();
  });

  it("blended ROAS above breakeven means profit", () => {
    const revenue = 10000;
    const profitBeforeAds = 4000; // 40% contribution
    const adSpend = 2000;
    const be = breakevenRoas(profitBeforeAds, revenue)!; // 2.5
    const blended = roas(revenue, adSpend)!; // 5.0
    expect(blended).toBeGreaterThan(be);
    expect(profitBeforeAds - adSpend).toBe(2000); // net positive
  });
});

describe("rollupDay", () => {
  const orders: RollupOrder[] = [
    {
      revenueCents: 2999,
      shippingChargedCents: 0,
      refundCents: 0,
      items: [{ productId: "p1", qty: 1, priceCents: 2999, costCents: 700 }],
    },
    {
      revenueCents: 5000,
      shippingChargedCents: 0,
      refundCents: 0,
      items: [
        { productId: "p1", qty: 1, priceCents: 3000, costCents: 1000 },
        { productId: "p2", qty: 1, priceCents: 2000, costCents: 500 },
      ],
    },
  ];

  it("produces an exact store-level row and per-product rows", () => {
    const rows = rollupDay(orders, FEE);
    const store = rows.find((r) => r.productId === null)!;
    const p1 = rows.find((r) => r.productId === "p1")!;
    const p2 = rows.find((r) => r.productId === "p2")!;

    // Store totals: orders 2; revenue 7999; cost 2200.
    // fees: order1 117, order2 round(5000*.029)=145+30=175 → 292.
    expect(store.orders).toBe(2);
    expect(store.revenueCents).toBe(7999);
    expect(store.costCents).toBe(2200);
    expect(store.paymentFeesCents).toBe(292);
    expect(store.profitCents).toBe(7999 - 2200 - 292); // 5507

    // p1 appears in both orders: revenue 2999+3000=5999, cost 700+1000=1700.
    expect(p1.revenueCents).toBe(5999);
    expect(p1.costCents).toBe(1700);
    expect(p1.orders).toBe(2);

    // p2: revenue 2000, cost 500; fee share of order2 = round(175*2000/5000)=70.
    expect(p2.revenueCents).toBe(2000);
    expect(p2.paymentFeesCents).toBe(70);
    expect(p2.profitCents).toBe(2000 - 500 - 70);

    // Per-product profit reconciles with the store row (no rounding drift here).
    expect(p1.profitCents + p2.profitCents).toBe(store.profitCents);
  });

  it("subtracts refunds and allocates them pro-rata by product revenue", () => {
    const rows = rollupDay(
      [
        {
          revenueCents: 5000,
          shippingChargedCents: 0,
          refundCents: 1000,
          items: [
            { productId: "p1", qty: 1, priceCents: 3000, costCents: 1000 },
            { productId: "p2", qty: 1, priceCents: 2000, costCents: 500 },
          ],
        },
      ],
      FEE,
    );
    const store = rows.find((r) => r.productId === null)!;
    const p1 = rows.find((r) => r.productId === "p1")!;
    const p2 = rows.find((r) => r.productId === "p2")!;

    // income 5000; fee 175; store profit = 5000 - 1500 - 175 - 1000 = 2325.
    expect(store.refundCents).toBe(1000);
    expect(store.profitCents).toBe(2325);

    // refund split 60/40 by revenue: p1 600, p2 400.
    expect(p1.refundCents).toBe(600);
    expect(p2.refundCents).toBe(400);
    expect(p1.profitCents + p2.profitCents).toBe(store.profitCents);
  });

  it("keeps unlinked items at the store level only", () => {
    const rows = rollupDay(
      [
        {
          revenueCents: 1000,
          shippingChargedCents: 0,
          refundCents: 0,
          items: [{ productId: null, qty: 1, priceCents: 1000, costCents: 200 }],
        },
      ],
      FEE,
    );
    expect(rows).toHaveLength(1); // store row only
    expect(rows[0].productId).toBeNull();
    expect(rows[0].costCents).toBe(200);
  });
});
