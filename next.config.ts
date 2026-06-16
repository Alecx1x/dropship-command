import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Redis/queue libs out of the bundler — they're Node-only and used
  // by server actions that enqueue background jobs.
  serverExternalPackages: ["bullmq", "ioredis"],
};

export default nextConfig;
