import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

/**
 * Edge proxy (Next.js 16's successor to middleware.ts) that gates every route.
 * It uses only the edge-safe authConfig (no Node APIs); the `authorized`
 * callback there decides who passes. This is the enforcement point for SPEC
 * 0.3: "every dashboard route and API route requires a session."
 */
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything EXCEPT Next internals, static assets, the NextAuth API
  // routes, and the Shopify webhook receiver (which authenticates via HMAC, not
  // a session — it must reach the handler, never be redirected to login).
  matcher: [
    "/((?!api/auth|api/webhooks|api/discovery|_next/static|_next/image|favicon.ico|.*\\.svg$).*)",
  ],
};
