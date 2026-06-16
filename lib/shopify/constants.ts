/**
 * Single source of truth for the Shopify Admin API version (CLAUDE.md).
 * Shopify versions are date-based (YYYY-MM), released quarterly, and each is
 * supported for ~12 months. Bump this deliberately — the GraphQL schema changes
 * between versions. The full client (task 1.3) builds on this constant.
 */
export const SHOPIFY_API_VERSION = "2026-01";

/** Admin GraphQL endpoint for a given *.myshopify.com domain. */
export function adminGraphqlEndpoint(shopDomain: string): string {
  return `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
}
