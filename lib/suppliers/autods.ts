import {
  aliexpressSearchUrl,
  type SupplierAdapter,
} from "./adapter";

/**
 * AutoDS adapter — STUB (SPEC 2.6). The real integration places orders and pulls
 * tracking/stock via the AutoDS API. Until that's wired, it degrades to manual
 * fulfillment so the handoff still produces an actionable task.
 *
 * TODO(real): implement placeOrder/getTracking/getStockPrice against the AutoDS
 * API using the supplier's encrypted apiKey (Supplier.apiKeyEnc).
 */
export const autodsAdapter: SupplierAdapter = {
  type: "AUTODS",

  async placeOrder(input) {
    const first = input.lineItems[0];
    return {
      status: "MANUAL_REQUIRED",
      manualUrl: first ? aliexpressSearchUrl(first.title) : undefined,
    };
  },

  async getTracking() {
    return { trackingNumber: null, carrier: null, status: null };
  },

  async getStockPrice() {
    return { inStock: true, costCents: null };
  },
};
