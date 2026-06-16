import type { NextAuthConfig } from "next-auth";

import { canAccessPath, landingPathFor, type Role } from "@/lib/auth/roles";

/**
 * Edge-safe NextAuth config, shared between the Edge middleware and the full
 * server config in auth.ts.
 *
 * CRITICAL: this file must NOT import Node-only APIs (node:crypto, Prisma, the
 * Credentials provider, etc.). Middleware runs on the Edge runtime where those
 * are unavailable. The Credentials provider — which uses scrypt — is added
 * only in auth.ts. Keeping the route-protection callback here lets middleware
 * enforce auth without dragging Node code into the Edge bundle.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  // Self-hosted (VPS/Vercel per CLAUDE.md): trust the host header. Without this,
  // NextAuth v5 throws UntrustedHost under `next start`. Equivalent to setting
  // AUTH_TRUST_HOST=true; kept in code so every environment behaves the same.
  trustHost: true,
  // Providers are added in auth.ts (Node runtime). Empty here by design.
  providers: [],
  callbacks: {
    /** Persist the account's role onto the JWT at sign-in (SPEC 5.4). */
    jwt({ token, user }) {
      if (user) token.role = user.role ?? "OWNER";
      return token;
    },
    /** Expose the role on the session so middleware + server components see it. */
    session({ session, token }) {
      if (session.user) session.user.role = (token.role as Role) ?? "OWNER";
      return session;
    },
    /**
     * Runs in the edge proxy for every matched request. Require a session;
     * bounce signed-in users off /login to their landing page; and enforce
     * role-based access — a VA hitting an owner-only route is redirected to the
     * fulfillment queue rather than shown a 403.
     */
    authorized({ auth, request: { nextUrl } }) {
      // TEMP bypass: DISABLE_AUTH=true makes the whole app public (no login).
      // For personal use with no real store data behind it. Remove the env var
      // (or set it to anything but "true") to re-enable the login gate.
      if (process.env.DISABLE_AUTH === "true") return true;

      const isLoggedIn = !!auth?.user;
      const role: Role = (auth?.user?.role as Role) ?? "OWNER";
      const isOnLogin = nextUrl.pathname === "/login";

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL(landingPathFor(role), nextUrl));
        }
        return true;
      }
      if (!isLoggedIn) return false;

      if (!canAccessPath(role, nextUrl.pathname)) {
        return Response.redirect(new URL(landingPathFor(role), nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
