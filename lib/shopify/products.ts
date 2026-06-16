import { z } from "zod";

import { gidToId, runBulkQuery, toCents, type BulkRunDeps } from "./bulk";
import { ShopifyClient } from "./client";

/**
 * Product + variant import via Shopify bulk operations (SPEC 1.5).
 *
 * Our schema stores one Product row per Shopify product (no variant table), so
 * we collapse variants to a representative: the lowest-priced variant supplies
 * priceCents / compareAtCents, and its inventoryItem.unitCost (when set in
 * Shopify) supplies an initial costCents. COGS is otherwise entered manually.
 */

export interface ParsedProduct {
  shopifyProductId: string;
  title: string;
  status: string; // Shopify: ACTIVE / ARCHIVED / DRAFT
  priceCents: number;
  compareAtCents: number | null;
  costCents: number | null; // from Shopify unit cost if available, else null
}

interface ParsedVariant {
  priceCents: number;
  compareAtCents: number | null;
  costCents: number | null;
}

const productRow = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string().nullable().optional(),
});

const variantRow = z.object({
  id: z.string(),
  price: z.string().nullable().optional(),
  compareAtPrice: z.string().nullable().optional(),
  inventoryItem: z
    .object({ unitCost: z.object({ amount: z.string() }).nullable().optional() })
    .nullable()
    .optional(),
  __parentId: z.string(),
});

/** Parse a products bulk JSONL into one ParsedProduct per product. */
export function parseProductsJsonl(jsonl: string): ParsedProduct[] {
  const products = new Map<string, z.infer<typeof productRow>>();
  const variantsByParent = new Map<string, ParsedVariant[]>();

  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : "";

    if (typeof obj.__parentId === "string") {
      if (!id.includes("/ProductVariant/")) continue;
      const v = variantRow.parse(obj);
      const variant: ParsedVariant = {
        priceCents: toCents(v.price),
        compareAtCents:
          v.compareAtPrice != null ? toCents(v.compareAtPrice) : null,
        costCents: v.inventoryItem?.unitCost
          ? toCents(v.inventoryItem.unitCost.amount)
          : null,
      };
      const arr = variantsByParent.get(v.__parentId) ?? [];
      arr.push(variant);
      variantsByParent.set(v.__parentId, arr);
    } else if (id.includes("/Product/")) {
      products.set(id, productRow.parse(obj));
    }
  }

  const result: ParsedProduct[] = [];
  for (const [gid, p] of products) {
    const variants = variantsByParent.get(gid) ?? [];
    // Representative = lowest-priced variant (the "from" price shoppers see).
    const rep = variants.reduce<ParsedVariant | null>(
      (lo, v) => (lo === null || v.priceCents < lo.priceCents ? v : lo),
      null,
    );
    result.push({
      shopifyProductId: gidToId(p.id),
      title: p.title,
      status: p.status ?? "ACTIVE",
      priceCents: rep?.priceCents ?? 0,
      compareAtCents: rep?.compareAtCents ?? null,
      costCents: rep?.costCents ?? null,
    });
  }
  return result;
}

const PRODUCTS_BULK_QUERY = `{
  products {
    edges { node {
      id
      title
      status
      variants { edges { node {
        id
        price
        compareAtPrice
        inventoryItem { unitCost { amount } }
      } } }
    } }
  }
}`;

export async function fetchProductsViaBulk(
  client: ShopifyClient,
  deps: BulkRunDeps = {},
): Promise<ParsedProduct[]> {
  return parseProductsJsonl(await runBulkQuery(client, PRODUCTS_BULK_QUERY, deps));
}
