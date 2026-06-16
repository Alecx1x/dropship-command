import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  ShopifyClient,
  ShopifyGraphQLError,
  ShopifyHttpError,
  type FetchLike,
} from "../../lib/shopify/client";

const SHOP = { name: z.string(), currencyCode: z.string() };
const shopSchema = z.object({ shop: z.object(SHOP) });

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

/** A fetch that returns each queued response in order (repeating the last). */
function queue(responses: Response[]): { fetchFn: FetchLike; calls: () => number } {
  let i = 0;
  const fn = (async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return r;
  }) as unknown as FetchLike;
  return { fetchFn: fn, calls: () => i };
}

function throttleBody(extra?: Partial<{ currentlyAvailable: number; restoreRate: number; requestedQueryCost: number }>) {
  return {
    errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }],
    extensions: {
      cost: {
        requestedQueryCost: extra?.requestedQueryCost ?? 100,
        actualQueryCost: null,
        throttleStatus: {
          maximumAvailable: 1000,
          currentlyAvailable: extra?.currentlyAvailable ?? 50,
          restoreRate: extra?.restoreRate ?? 50,
        },
      },
    },
  };
}

function makeClient(
  responses: Response[],
  opts?: { maxRetries?: number },
): { client: ShopifyClient; sleeps: number[]; calls: () => number } {
  const sleeps: number[] = [];
  const { fetchFn, calls } = queue(responses);
  const client = new ShopifyClient({
    shopDomain: "test.myshopify.com",
    accessToken: "shpat_test",
    fetchFn,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0, // deterministic backoff (no jitter)
    maxRetries: opts?.maxRetries ?? 3,
  });
  return { client, sleeps, calls };
}

describe("ShopifyClient", () => {
  it("returns typed data on success and records throttle status", async () => {
    const { client, sleeps } = makeClient([
      json({
        data: { shop: { name: "Test Store", currencyCode: "USD" } },
        extensions: {
          cost: {
            requestedQueryCost: 1,
            actualQueryCost: 1,
            throttleStatus: { maximumAvailable: 1000, currentlyAvailable: 999, restoreRate: 50 },
          },
        },
      }),
    ]);

    const data = await client.request("{ shop { name currencyCode } }", undefined, shopSchema);
    expect(data.shop.name).toBe("Test Store");
    expect(sleeps).toHaveLength(0);
    expect(client.throttleStatus?.currentlyAvailable).toBe(999);
  });

  it("retries a transient 503 then succeeds", async () => {
    const { client, sleeps, calls } = makeClient([
      json({}, { status: 503 }),
      json({ data: { shop: { name: "OK", currencyCode: "USD" } } }),
    ]);

    const data = await client.request("{ shop }", undefined, shopSchema);
    expect(data.shop.name).toBe("OK");
    expect(calls()).toBe(2);
    expect(sleeps).toHaveLength(1);
    expect(sleeps[0]).toBe(500); // 500 * 2^0, jitter zeroed
  });

  it("honors Retry-After on a 429", async () => {
    const { client, sleeps } = makeClient([
      json({}, { status: 429, headers: { "Retry-After": "2" } }),
      json({ data: { shop: { name: "OK", currencyCode: "USD" } } }),
    ]);

    await client.request("{ shop }", undefined, shopSchema);
    expect(sleeps[0]).toBe(2000); // 2 seconds
  });

  it("waits out a THROTTLED error using throttleStatus, then retries", async () => {
    const { client, sleeps } = makeClient([
      json(throttleBody({ requestedQueryCost: 100, currentlyAvailable: 50, restoreRate: 50 })),
      json({ data: { shop: { name: "OK", currencyCode: "USD" } } }),
    ]);

    const data = await client.request("{ shop }", undefined, shopSchema);
    expect(data.shop.name).toBe("OK");
    // deficit (100-50)=50 / 50 per sec = 1s, +0.2s buffer => 1200ms.
    expect(sleeps[0]).toBe(1200);
  });

  it("throws ShopifyGraphQLError on a non-throttle GraphQL error without retrying", async () => {
    const { client, sleeps, calls } = makeClient([
      json({ errors: [{ message: "Field 'bogus' doesn't exist" }] }),
    ]);

    await expect(client.request("{ bogus }", undefined, shopSchema)).rejects.toBeInstanceOf(
      ShopifyGraphQLError,
    );
    expect(calls()).toBe(1);
    expect(sleeps).toHaveLength(0);
  });

  it("gives up with ShopifyHttpError after exhausting retries on persistent 500", async () => {
    const { client, calls } = makeClient([json({}, { status: 500 })], { maxRetries: 2 });

    await expect(client.request("{ shop }", undefined, shopSchema)).rejects.toBeInstanceOf(
      ShopifyHttpError,
    );
    expect(calls()).toBe(3); // 1 initial + 2 retries
  });

  it("validates the payload against the caller's schema", async () => {
    const { client } = makeClient([
      json({ data: { shop: { name: "Missing currency" } } }),
    ]);

    await expect(
      client.request("{ shop }", undefined, shopSchema),
    ).rejects.toBeInstanceOf(z.ZodError);
  });
});
