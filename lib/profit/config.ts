import type { PaymentFeeConfig } from "./profit";

/**
 * Payment processor fee used by the P&L engine (SPEC 3.1). Defaults to Shopify
 * Payments (2.9% + 30¢); override via env. Per-store config can come later.
 */
export const defaultFeeConfig: PaymentFeeConfig = {
  percent: Number(process.env.PAYMENT_FEE_PERCENT ?? "2.9"),
  fixedCents: Number(process.env.PAYMENT_FEE_FIXED_CENTS ?? "30"),
};
