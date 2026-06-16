import { z } from "zod";

import { adminGraphqlEndpoint } from "./constants";

/**
 * Resilient Shopify Admin GraphQL client (SPEC 1.3).
 *
 * Handles the things every later sync task depends on:
 *  - Versioned endpoint (lib/shopify/constants.ts).
 *  - Cost-aware throttling: Shopify uses a leaky-bucket of query-cost points.
 *    On a THROTTLED error we wait exactly long enough for the bucket to refill
 *    (deficit / restoreRate) and retry. We also track the latest throttle
 *    status so callers can pace bulk work.
 *  - Retry with exponential backoff + jitter for transient HTTP failures
 *    (429 / 5xx / network), honoring a Retry-After header when present.
 *  - zod-typed responses: the caller passes the schema for `data`, so every
 *    call site gets a validated, typed result (CLAUDE.md: zod on every
 *    external response).
 *
 * Node-only (uses fetch on the server). `fetchFn` and `sleep` are injectable so
 * the retry/throttle logic is unit-testable without real network or real waits.
 */

export type FetchLike = typeof fetch;

export interface ShopifyClientOptions {
  shopDomain: string;
  accessToken: string;
  /** Max retries for transient failures (total attempts = maxRetries + 1). */
  maxRetries?: number;
  fetchFn?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export class ShopifyHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ShopifyHttpError";
  }
}

export class ShopifyGraphQLError extends Error {
  constructor(
    message: string,
    readonly errors?: unknown,
  ) {
    super(message);
    this.name = "ShopifyGraphQLError";
  }
}

export interface ThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

const throttleStatusSchema = z.object({
  maximumAvailable: z.number(),
  currentlyAvailable: z.number(),
  restoreRate: z.number(),
});

const costSchema = z.object({
  requestedQueryCost: z.number(),
  actualQueryCost: z.number().nullable().optional(),
  throttleStatus: throttleStatusSchema,
});

const gqlErrorSchema = z.object({
  message: z.string(),
  extensions: z.object({ code: z.string().optional() }).partial().optional(),
});

const envelopeSchema = z.object({
  data: z.unknown().optional(),
  errors: z.array(gqlErrorSchema).optional(),
  extensions: z.object({ cost: costSchema.optional() }).optional(),
});

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class ShopifyClient {
  private readonly endpoint: string;
  private readonly accessToken: string;
  private readonly maxRetries: number;
  private readonly fetchFn: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  /** Most recent throttle status reported by Shopify, if any. */
  throttleStatus: ThrottleStatus | null = null;

  constructor(options: ShopifyClientOptions) {
    this.endpoint = adminGraphqlEndpoint(options.shopDomain);
    this.accessToken = options.accessToken;
    this.maxRetries = options.maxRetries ?? 3;
    this.fetchFn = options.fetchFn ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
  }

  /**
   * Run a GraphQL query/mutation and return `data` validated against `schema`.
   * Throws ShopifyHttpError (transport) or ShopifyGraphQLError (GraphQL-level).
   */
  async request<T>(
    query: string,
    variables: Record<string, unknown> | undefined,
    schema: z.ZodType<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchFn(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": this.accessToken,
          },
          body: JSON.stringify({ query, variables }),
          cache: "no-store",
        });
      } catch (cause) {
        // Network error — retry if we can.
        if (attempt < this.maxRetries) {
          await this.sleep(this.backoffMs(attempt, null));
          continue;
        }
        throw new ShopifyHttpError(
          `Network error reaching Shopify: ${(cause as Error)?.message ?? "unknown"}`,
          0,
        );
      }

      // Transient transport failures: retry with backoff (honor Retry-After).
      if (res.status === 429 || res.status >= 500) {
        if (attempt < this.maxRetries) {
          await this.sleep(this.backoffMs(attempt, res.headers.get("Retry-After")));
          continue;
        }
        throw new ShopifyHttpError(`Shopify returned HTTP ${res.status}.`, res.status);
      }
      if (!res.ok) {
        throw new ShopifyHttpError(`Shopify returned HTTP ${res.status}.`, res.status);
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new ShopifyGraphQLError("Shopify returned a non-JSON response.");
      }

      const envelope = envelopeSchema.safeParse(json);
      if (!envelope.success) {
        throw new ShopifyGraphQLError("Unexpected response envelope from Shopify.");
      }

      const cost = envelope.data.extensions?.cost;
      if (cost) this.throttleStatus = cost.throttleStatus;

      const errors = envelope.data.errors;
      if (errors && errors.length > 0) {
        const isThrottled = errors.some(
          (e) => e.extensions?.code === "THROTTLED",
        );
        if (isThrottled && attempt < this.maxRetries) {
          await this.sleep(this.throttleWaitMs(cost));
          continue;
        }
        throw new ShopifyGraphQLError(
          errors.map((e) => e.message).join("; "),
          errors,
        );
      }

      if (envelope.data.data == null) {
        throw new ShopifyGraphQLError("Shopify returned no data.");
      }

      // Validate the payload against the caller's schema → typed result.
      return schema.parse(envelope.data.data);
    }
  }

  /** Backoff for transient HTTP failures: Retry-After if given, else 2^n + jitter. */
  private backoffMs(attempt: number, retryAfter: string | null): number {
    if (retryAfter) {
      const secs = Number(retryAfter);
      if (Number.isFinite(secs) && secs >= 0) return secs * 1000;
    }
    const base = 500 * 2 ** attempt; // 500, 1000, 2000, ...
    return Math.round(base + this.random() * 0.3 * base);
  }

  /** Wait for the cost bucket to refill enough for the requested query. */
  private throttleWaitMs(
    cost: z.infer<typeof costSchema> | undefined,
  ): number {
    if (!cost) return 1000;
    const { requestedQueryCost, throttleStatus } = cost;
    const deficit = Math.max(
      0,
      requestedQueryCost - throttleStatus.currentlyAvailable,
    );
    const seconds =
      throttleStatus.restoreRate > 0 ? deficit / throttleStatus.restoreRate : 1;
    // Small buffer so we don't wake a hair too early.
    return Math.ceil((seconds + 0.2) * 1000);
  }
}
