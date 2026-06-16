import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

/**
 * Shared Prisma client for the app runtime.
 *
 * Prisma 7's `prisma-client` generator is engine-free and requires a driver
 * adapter. We use @prisma/adapter-pg over the POOLED Neon connection
 * (DATABASE_URL with &pgbouncer=true) so serverless invocations don't exhaust
 * direct connections. Migrations use the direct URL via prisma.config.ts.
 *
 * A single instance is cached on globalThis so Next's dev hot-reload doesn't
 * open a new pool on every change.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
