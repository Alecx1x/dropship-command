/**
 * Role-based access (SPEC 5.4). Two roles: the OWNER sees everything; a VA
 * (virtual assistant) sees only the fulfillment queue — the operational work
 * they're delegated — with no access to profit, research, ad spend, store
 * access tokens, or the AI tools.
 *
 * Pure path logic, unit-tested in isolation. The edge proxy (auth.config.ts)
 * enforces it and the UI consumes it; this file imports nothing Node-only so it
 * is safe in the Edge bundle.
 *
 * "Support views" in the SPEC reduces to fulfillment for now: there is no
 * support inbox (explicitly out of scope for v1 — Shopify Inbox / email cover
 * that). Add prefixes here when a VA needs more surface.
 */
export type Role = "OWNER" | "VA";

/** Path prefixes a VA may reach. Everything else is owner-only. */
export const VA_ALLOWED_PREFIXES = ["/fulfillment"] as const;

/** Where each role lands after login and when it hits a route it can't see. */
export function landingPathFor(role: Role): string {
  return role === "VA" ? "/fulfillment" : "/";
}

/** Can this role view this pathname? Owner: always. VA: allowed prefixes only. */
export function canAccessPath(role: Role, pathname: string): boolean {
  if (role === "OWNER") return true;
  return VA_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
