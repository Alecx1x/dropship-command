/**
 * SupplierAdapter strategy interface (SPEC 2.6). Each supplier integration
 * implements the same three operations so the fulfillment engine is supplier-
 * agnostic. v1 ships MANUAL (human places the order) and an AutoDS stub.
 */

export type SupplierType = "AUTODS" | "SPOCKET" | "CJ" | "MANUAL";

export interface FulfillmentLineItem {
  title: string;
  quantity: number;
  shopifyProductId: string | null;
}

export interface PlaceOrderInput {
  orderNumber: string;
  customerEmail: string | null;
  lineItems: FulfillmentLineItem[];
}

export interface PlaceOrderResult {
  // PLACED: ordered via API. MANUAL_REQUIRED: a human must place it (manualUrl
  // is a one-click link to the supplier).
  status: "PLACED" | "MANUAL_REQUIRED";
  externalOrderId?: string;
  manualUrl?: string;
}

export interface TrackingInfo {
  trackingNumber: string | null;
  carrier: string | null;
  status: string | null;
}

export interface StockPrice {
  inStock: boolean;
  costCents: number | null;
}

export interface SupplierAdapter {
  readonly type: SupplierType;
  placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult>;
  getTracking(externalOrderId: string): Promise<TrackingInfo>;
  getStockPrice(shopifyProductId: string): Promise<StockPrice>;
}

/** A one-click AliExpress search link for a product title (manual fulfillment). */
export function aliexpressSearchUrl(title: string): string {
  return `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(title)}`;
}
