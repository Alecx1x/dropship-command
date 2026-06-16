import {
  aliexpressSearchUrl,
  type SupplierAdapter,
} from "./adapter";

/**
 * MANUAL adapter (SPEC 2.6): the owner places the order themselves. placeOrder
 * returns MANUAL_REQUIRED with a one-click supplier search link; tracking and
 * stock/price aren't available programmatically.
 */
export const manualAdapter: SupplierAdapter = {
  type: "MANUAL",

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
