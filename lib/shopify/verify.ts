import { z } from "zod";

import { adminGraphqlEndpoint } from "./constants";

/**
 * Minimal Shopify Admin API credential check for store registration (SPEC 1.2):
 * run `shop { name currencyCode }` and confirm the token works. The full,
 * resilient GraphQL client (cost-aware throttling, retries) is task 1.3; this
 * is a single typed call so 1.2 can validate credentials before saving.
 */

const shopInfoSchema = z.object({
  name: z.string(),
  currencyCode: z.string(),
});
export type ShopInfo = z.infer<typeof shopInfoSchema>;

export type VerifyResult =
  | { ok: true; shop: ShopInfo }
  | { ok: false; error: string };

const okResponseSchema = z.object({
  data: z.object({ shop: shopInfoSchema }),
});
const errorResponseSchema = z.object({
  errors: z.array(z.object({ message: z.string() })).min(1),
});

export async function verifyShopifyCredentials(
  shopDomain: string,
  accessToken: string,
): Promise<VerifyResult> {
  let res: Response;
  try {
    res = await fetch(adminGraphqlEndpoint(shopDomain), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: "{ shop { name currencyCode } }" }),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      error: `Could not reach ${shopDomain}. Double-check the domain.`,
    };
  }

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      error:
        "Shopify rejected the access token. Check that it's an Admin API token with read_products / read_orders scopes.",
    };
  }
  if (res.status === 404) {
    return { ok: false, error: `No Shopify store found at ${shopDomain}.` };
  }
  if (res.status === 429) {
    return { ok: false, error: "Shopify rate-limited the request. Try again shortly." };
  }
  if (!res.ok) {
    return { ok: false, error: `Shopify returned HTTP ${res.status}.` };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: "Shopify returned a non-JSON response." };
  }

  // GraphQL-level errors come back as HTTP 200 with an `errors` array.
  const asError = errorResponseSchema.safeParse(json);
  if (asError.success) {
    return { ok: false, error: asError.data.errors[0].message };
  }

  const parsed = okResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: "Unexpected response shape from Shopify." };
  }

  return { ok: true, shop: parsed.data.data.shop };
}
