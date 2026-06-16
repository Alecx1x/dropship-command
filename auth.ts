import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { verifyPassword } from "@/lib/auth/password";

/**
 * Full NextAuth config (Node runtime). Extends the edge-safe authConfig with
 * the Credentials provider, which uses node:crypto and therefore can only run
 * here / in the /api/auth route handler — never in middleware.
 *
 * Env-defined accounts (SPEC 0.3 + 5.4): the owner account is the one required
 * login (AUTH_USER_EMAIL + AUTH_USER_PASSWORD_HASH). An optional VA (virtual
 * assistant) account (AUTH_VA_EMAIL + AUTH_VA_PASSWORD_HASH) gets the VA role —
 * fulfillment-only access. Both live in env, so there is still no users table.
 */

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** True if the submitted credentials match an account's configured email+hash. */
function accountMatches(
  email: string,
  password: string,
  expectedEmail: string | undefined,
  expectedHash: string | undefined,
): boolean {
  if (!expectedEmail || !expectedHash) return false;
  if (email.toLowerCase() !== expectedEmail.toLowerCase()) return false;
  return verifyPassword(password, expectedHash);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const ownerEmail = process.env.AUTH_USER_EMAIL;
        const ownerHash = process.env.AUTH_USER_PASSWORD_HASH;
        if (!ownerEmail || !ownerHash) {
          throw new Error(
            "AUTH_USER_EMAIL / AUTH_USER_PASSWORD_HASH are not set — configure the owner account in .env.",
          );
        }

        if (accountMatches(email, password, ownerEmail, ownerHash)) {
          return { id: "owner", email: ownerEmail, name: "Owner", role: "OWNER" };
        }

        // Optional VA account — fulfillment-only access (SPEC 5.4).
        const vaEmail = process.env.AUTH_VA_EMAIL;
        const vaHash = process.env.AUTH_VA_PASSWORD_HASH;
        if (accountMatches(email, password, vaEmail, vaHash)) {
          return { id: "va", email: vaEmail!, name: "VA", role: "VA" };
        }

        return null;
      },
    }),
  ],
});
