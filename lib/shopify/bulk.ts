import { z } from "zod";

import { ShopifyClient } from "./client";

/**
 * Shopify Admin API bulk operations for backfilling large datasets (SPEC 1.4).
 *
 * Flow: kick off a bulk query → poll currentBulkOperation until COMPLETED →
 * download the resulting JSONL file → reassemble nested objects. In a bulk
 * result, connection children (line items) are emitted as their own lines with
 * a `__parentId` pointing back at the parent order, so we group them client-side.
 *
 * The orchestration takes injectable `sleep`/`fetchFn` so it's testable; the
 * JSONL parser is pure.
 */

// --- value helpers ---------------------------------------------------------

/** "gid://shopify/Order/12345" -> "12345". */
export function gidToId(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1];
}

/** Shopify money strings ("29.99") -> integer cents (2999). */
export function toCents(amount: string | number | null | undefined): number {
  if (amount == null) return 0;
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

// --- parsed shapes ---------------------------------------------------------

export interface ParsedLineItem {
  shopifyLineItemId: string;
  shopifyProductId: string | null;
  quantity: number;
  priceCents: number;
}

export interface ParsedOrder {
  shopifyOrderId: string;
  orderNumber: string;
  placedAt: Date;
  financialStatus: string;
  fulfillmentStatus: string | null;
  customerEmail: string | null;
  revenueCents: number;
  shippingChargedCents: number;
  taxCents: number;
  currency: string;
  lineItems: ParsedLineItem[];
}

const moneySet = z
  .object({
    shopMoney: z.object({
      amount: z.string(),
      currencyCode: z.string().optional(),
    }),
  })
  .nullable()
  .optional();

const orderRow = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  displayFinancialStatus: z.string().nullable().optional(),
  displayFulfillmentStatus: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  currentTotalPriceSet: moneySet,
  totalShippingPriceSet: moneySet,
  totalTaxSet: moneySet,
});

const lineItemRow = z.object({
  id: z.string(),
  quantity: z.number(),
  originalUnitPriceSet: moneySet,
  product: z.object({ id: z.string() }).nullable().optional(),
  __parentId: z.string(),
});

/**
 * Parse a bulk-operation JSONL string into orders with nested line items.
 * Unknown line types are ignored. Pure and deterministic.
 */
export function parseOrdersJsonl(jsonl: string): ParsedOrder[] {
  const orders = new Map<string, ParsedOrder>(); // keyed by raw order gid
  const itemsByParent = new Map<string, ParsedLineItem[]>();

  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : "";

    if (typeof obj.__parentId === "string") {
      // A connection child. We only care about line items here.
      if (!id.includes("/LineItem/")) continue;
      const li = lineItemRow.parse(obj);
      const item: ParsedLineItem = {
        shopifyLineItemId: gidToId(li.id),
        shopifyProductId: li.product ? gidToId(li.product.id) : null,
        quantity: li.quantity,
        priceCents: toCents(li.originalUnitPriceSet?.shopMoney.amount),
      };
      const arr = itemsByParent.get(li.__parentId) ?? [];
      arr.push(item);
      itemsByParent.set(li.__parentId, arr);
    } else if (id.includes("/Order/")) {
      const o = orderRow.parse(obj);
      orders.set(o.id, {
        shopifyOrderId: gidToId(o.id),
        orderNumber: o.name,
        placedAt: new Date(o.createdAt),
        financialStatus: o.displayFinancialStatus ?? "UNKNOWN",
        fulfillmentStatus: o.displayFulfillmentStatus ?? null,
        customerEmail: o.email ?? null,
        revenueCents: toCents(o.currentTotalPriceSet?.shopMoney.amount),
        shippingChargedCents: toCents(o.totalShippingPriceSet?.shopMoney.amount),
        taxCents: toCents(o.totalTaxSet?.shopMoney.amount),
        currency: o.currentTotalPriceSet?.shopMoney.currencyCode ?? "USD",
        lineItems: [],
      });
    }
  }

  for (const [parentGid, items] of itemsByParent) {
    const order = orders.get(parentGid);
    if (order) order.lineItems = items;
  }

  return [...orders.values()];
}

// --- orchestration ---------------------------------------------------------

const bulkRunSchema = z.object({
  bulkOperationRunQuery: z.object({
    bulkOperation: z.object({ id: z.string(), status: z.string() }).nullable(),
    userErrors: z.array(z.object({ message: z.string() })),
  }),
});

const currentBulkSchema = z.object({
  currentBulkOperation: z
    .object({
      id: z.string(),
      status: z.string(),
      errorCode: z.string().nullable().optional(),
      objectCount: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
    })
    .nullable(),
});

/** The bulk query that pulls orders + line items created since `sinceDate`. */
function ordersBulkQuery(sinceDate: string): string {
  return `{
    orders(query: "created_at:>=${sinceDate}") {
      edges { node {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        email
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        totalShippingPriceSet { shopMoney { amount } }
        totalTaxSet { shopMoney { amount } }
        lineItems { edges { node {
          id
          quantity
          originalUnitPriceSet { shopMoney { amount } }
          product { id }
        } } }
      } }
    }
  }`;
}

export interface BulkRunDeps {
  sleep?: (ms: number) => Promise<void>;
  fetchFn?: typeof fetch;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Run the orders bulk operation end-to-end and return parsed orders.
 * `sinceDate` is a YYYY-MM-DD string.
 */
/**
 * Run any bulk query end-to-end and return the raw JSONL (empty string if the
 * operation produced no results). Shared by the order and product backfills.
 */
export async function runBulkQuery(
  client: ShopifyClient,
  query: string,
  deps: BulkRunDeps = {},
): Promise<string> {
  const sleep = deps.sleep ?? defaultSleep;
  const fetchFn = deps.fetchFn ?? fetch;
  const pollInterval = deps.pollIntervalMs ?? 2000;
  const maxWait = deps.maxWaitMs ?? 5 * 60 * 1000;

  // 1. Start the bulk operation.
  const runMutation = `mutation Run($q: String!) {
    bulkOperationRunQuery(query: $q) {
      bulkOperation { id status }
      userErrors { message }
    }
  }`;
  const run = await client.request(runMutation, { q: query }, bulkRunSchema);
  if (run.bulkOperationRunQuery.userErrors.length > 0) {
    throw new Error(
      `Bulk operation rejected: ${run.bulkOperationRunQuery.userErrors
        .map((e) => e.message)
        .join("; ")}`,
    );
  }
  if (!run.bulkOperationRunQuery.bulkOperation) {
    throw new Error("Bulk operation did not start.");
  }

  // 2. Poll until terminal.
  let waited = 0;
  let url: string | null = null;
  for (;;) {
    const status = await client.request(
      `{ currentBulkOperation { id status errorCode objectCount url } }`,
      undefined,
      currentBulkSchema,
    );
    const op = status.currentBulkOperation;
    if (!op) throw new Error("No current bulk operation while polling.");

    if (op.status === "COMPLETED") {
      url = op.url ?? null;
      break;
    }
    if (op.status === "FAILED" || op.status === "CANCELED") {
      throw new Error(
        `Bulk operation ${op.status}${op.errorCode ? `: ${op.errorCode}` : ""}.`,
      );
    }
    if (waited >= maxWait) throw new Error("Bulk operation timed out.");
    await sleep(pollInterval);
    waited += pollInterval;
  }

  // 3. Empty result → no file URL.
  if (!url) return "";

  // 4. Download the JSONL.
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(`Failed to download bulk result: HTTP ${res.status}.`);
  }
  return res.text();
}

export async function fetchOrdersViaBulk(
  client: ShopifyClient,
  sinceDate: string,
  deps: BulkRunDeps = {},
): Promise<ParsedOrder[]> {
  return parseOrdersJsonl(await runBulkQuery(client, ordersBulkQuery(sinceDate), deps));
}
