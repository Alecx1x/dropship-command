import IORedis from "ioredis";

/**
 * Redis connections for BullMQ (Upstash, TLS via rediss://).
 *
 * BullMQ requires `maxRetriesPerRequest: null` on every connection it consumes,
 * otherwise the blocking commands workers rely on throw under load. Queues can
 * share one connection; a Worker should get its own (its blocking reads would
 * otherwise tie up a shared connection), so we expose a factory too.
 */
function options() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set.");
  return { url };
}

export function createConnection(): IORedis {
  return new IORedis(options().url, { maxRetriesPerRequest: null });
}

/** Shared connection for producers (Queues). */
export const connection = createConnection();
