import { z } from "zod";

import { gidToId, toCents, type ParsedOrder } from "../shopify/bulk";

/**
 * Parse a Shopify orders/create | orders/updated webhook payload (SPEC 2.3).
 *
 * Webhooks deliver the REST-style order object, whose field names differ from
 * the GraphQL bulk shape (snake_case, total_price as a string, line_items, etc.)
 * — so it needs its own parser, but it produces the same ParsedOrder the upsert
 * expects. Pure and tested.
 *
 * IMPORTANT: Shopify order/line-item ids exceed JS's safe-integer range, so the
 * numeric `id` is already corrupted by JSON.parse. We use `admin_graphql_api_id`
 * (a gid STRING, preserved losslessly) for ids whenever present.
 */

const idLike = z.union([z.number(), z.string()]);

const lineItemSchema = z.object({
  id: idLike,
  admin_graphql_api_id: z.string().optional(),
  product_id: idLike.nullable().optional(),
  quantity: z.number(),
  price: z.string().nullable().optional(),
});

const orderSchema = z.object({
  id: idLike,
  admin_graphql_api_id: z.string().optional(),
  name: z.string().nullable().optional(),
  order_number: idLike.nullable().optional(),
  created_at: z.string(),
  financial_status: z.string().nullable().optional(),
  fulfillment_status: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  customer: z
    .object({ email: z.string().nullable().optional() })
    .nullable()
    .optional(),
  total_price: z.string().nullable().optional(),
  total_tax: z.string().nullable().optional(),
  total_shipping_price_set: z
    .object({
      shop_money: z.object({ amount: z.string() }).nullable().optional(),
    })
    .nullable()
    .optional(),
  currency: z.string().nullable().optional(),
  line_items: z.array(lineItemSchema).default([]),
});

export function parseWebhookOrder(payload: unknown): ParsedOrder {
  const o = orderSchema.parse(payload);
  // Prefer the gid string (lossless); fall back to the numeric id only if absent.
  const id = o.admin_graphql_api_id
    ? gidToId(o.admin_graphql_api_id)
    : String(o.id);

  return {
    shopifyOrderId: id,
    orderNumber:
      o.name ?? (o.order_number != null ? `#${o.order_number}` : id),
    placedAt: new Date(o.created_at),
    financialStatus: o.financial_status ?? "UNKNOWN",
    fulfillmentStatus: o.fulfillment_status ?? null,
    customerEmail: o.email ?? o.customer?.email ?? null,
    revenueCents: toCents(o.total_price),
    shippingChargedCents: toCents(o.total_shipping_price_set?.shop_money?.amount),
    taxCents: toCents(o.total_tax),
    currency: o.currency ?? "USD",
    lineItems: o.line_items.map((li) => ({
      shopifyLineItemId: li.admin_graphql_api_id
        ? gidToId(li.admin_graphql_api_id)
        : String(li.id),
      shopifyProductId: li.product_id != null ? String(li.product_id) : null,
      quantity: li.quantity,
      priceCents: toCents(li.price),
    })),
  };
}
