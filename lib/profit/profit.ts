/**
 * P&L engine (SPEC 3.1) — PURE functions, no DB. All money is integer cents.
 *
 * Profit = income − COGS − payment fees − refunds, where:
 *  - income      = product revenue + shipping charged to the customer
 *  - COGS        = unit cost + supplier shipping (already combined in
 *                  OrderItem.costCents), summed over line items
 *  - payment fee = income × percent + fixed (e.g. Shopify Payments 2.9% + 30¢)
 *  - refunds     = amount refunded (0 until refund tracking lands in 3.4)
 *
 * Tax is excluded — it's collected then remitted, not income.
 */

export interface PaymentFeeConfig {
  percent: number; // e.g. 2.9
  fixedCents: number; // e.g. 30
}

export interface OrderProfitInput {
  revenueCents: number;
  shippingChargedCents: number;
  productCostCents: number; // Σ item.costCents × qty (COGS incl. supplier shipping)
  refundCents: number;
}

export interface OrderProfit {
  incomeCents: number;
  costCents: number;
  paymentFeesCents: number;
  refundCents: number;
  profitCents: number;
  marginPct: number | null;
}

export function paymentFeeCents(
  incomeCents: number,
  fee: PaymentFeeConfig,
): number {
  return Math.round(incomeCents * (fee.percent / 100)) + fee.fixedCents;
}

export function computeOrderProfit(
  input: OrderProfitInput,
  fee: PaymentFeeConfig,
): OrderProfit {
  const incomeCents = input.revenueCents + input.shippingChargedCents;
  const paymentFeesCents = paymentFeeCents(incomeCents, fee);
  const profitCents =
    incomeCents - input.productCostCents - paymentFeesCents - input.refundCents;
  return {
    incomeCents,
    costCents: input.productCostCents,
    paymentFeesCents,
    refundCents: input.refundCents,
    profitCents,
    marginPct: incomeCents > 0 ? (profitCents / incomeCents) * 100 : null,
  };
}

// --- ratios (for the profit dashboard, SPEC 3.3) ---------------------------

/** Net margin as a percentage of revenue, or null if no revenue. */
export function marginRatioPct(
  profitCents: number,
  revenueCents: number,
): number | null {
  return revenueCents > 0 ? (profitCents / revenueCents) * 100 : null;
}

/** Blended ROAS = revenue ÷ ad spend, or null if no spend. */
export function roas(revenueCents: number, adSpendCents: number): number | null {
  return adSpendCents > 0 ? revenueCents / adSpendCents : null;
}

/**
 * Breakeven ROAS — the revenue-per-ad-dollar at which net profit is zero, i.e.
 * revenue ÷ contribution margin (profit before ad spend). Blended ROAS above
 * this is profitable. Null if there's no positive contribution margin.
 */
export function breakevenRoas(
  profitBeforeAdsCents: number,
  revenueCents: number,
): number | null {
  return profitBeforeAdsCents > 0 ? revenueCents / profitBeforeAdsCents : null;
}

// --- daily rollup ----------------------------------------------------------

export interface RollupLineItem {
  productId: string | null;
  qty: number;
  priceCents: number;
  costCents: number; // per-unit COGS incl. supplier shipping
}

export interface RollupOrder {
  revenueCents: number;
  shippingChargedCents: number;
  refundCents: number;
  items: RollupLineItem[];
}

export interface MetricRow {
  productId: string | null; // null = store-level row
  orders: number;
  revenueCents: number;
  costCents: number;
  paymentFeesCents: number;
  refundCents: number;
  profitCents: number;
}

function emptyRow(productId: string | null): MetricRow {
  return {
    productId,
    orders: 0,
    revenueCents: 0,
    costCents: 0,
    paymentFeesCents: 0,
    refundCents: 0,
    profitCents: 0,
  };
}

function itemCost(o: RollupOrder): number {
  return o.items.reduce((s, i) => s + i.costCents * i.qty, 0);
}

/**
 * Roll a day's orders into one store-level row (productId null) plus one row per
 * product. Order-level payment fees and refunds are allocated to products
 * pro-rata by product revenue; the store row is computed from exact order totals
 * (so it never suffers per-product rounding drift). Unlinked items count only at
 * the store level.
 */
export function rollupDay(
  orders: RollupOrder[],
  fee: PaymentFeeConfig,
): MetricRow[] {
  const store = emptyRow(null);
  const products = new Map<string, MetricRow>();

  for (const o of orders) {
    const income = o.revenueCents + o.shippingChargedCents;
    const orderFee = paymentFeeCents(income, fee);
    const cost = itemCost(o);

    store.orders += 1;
    store.revenueCents += income;
    store.costCents += cost;
    store.paymentFeesCents += orderFee;
    store.refundCents += o.refundCents;
    store.profitCents += income - cost - orderFee - o.refundCents;

    const productRevenue = o.items.reduce(
      (s, i) => s + i.priceCents * i.qty,
      0,
    );
    for (const it of o.items) {
      if (it.productId === null) continue;
      const r = it.priceCents * it.qty;
      const c = it.costCents * it.qty;
      const share = productRevenue > 0 ? r / productRevenue : 0;
      const feeShare = Math.round(orderFee * share);
      const refundShare = Math.round(o.refundCents * share);

      const row = products.get(it.productId) ?? emptyRow(it.productId);
      row.orders += 1;
      row.revenueCents += r;
      row.costCents += c;
      row.paymentFeesCents += feeShare;
      row.refundCents += refundShare;
      row.profitCents += r - c - feeShare - refundShare;
      products.set(it.productId, row);
    }
  }

  return [store, ...products.values()];
}
