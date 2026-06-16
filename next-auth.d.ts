import type { DefaultSession } from "next-auth";

import type { Role } from "@/lib/auth/roles";

/**
 * Augment NextAuth's User/Session/JWT with the `role` we thread through the
 * token (SPEC 5.4) so the edge proxy and server components can read it.
 */
declare module "next-auth" {
  interface User {
    role?: Role;
  }
  interface Session {
    user: { role?: Role } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
  }
}
