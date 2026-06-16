import { z } from "zod";

import { ShopifyClient } from "./client";

/**
 * Register Shopify webhook subscriptions for a store (SPEC 2.2). Idempotent:
 * we list existing subscriptions and only create the topics that aren't already
 * pointed at our callback URL, so the same routine handles initial registration
 * AND the nightly re-verify.
 */

// GraphQL WebhookSubscriptionTopic enum values we subscribe to. These mirror the
// header topics handled in lib/webhooks/handle.ts (slash → underscore, upper).
export const REQUIRED_TOPICS = [
  "ORDERS_CREATE",
  "ORDERS_UPDATED",
  "REFUNDS_CREATE",
  "PRODUCTS_UPDATE",
  "INVENTORY_LEVELS_UPDATE",
  "APP_UNINSTALLED",
] as const;

export interface ExistingSubscription {
  topic: string;
  callbackUrl: string | null;
}

/** Which required topics are not yet subscribed at this exact callback URL. */
export function topicsToCreate(
  required: readonly string[],
  existing: ExistingSubscription[],
  callbackUrl: string,
): string[] {
  const have = new Set(
    existing.filter((e) => e.callbackUrl === callbackUrl).map((e) => e.topic),
  );
  return required.filter((t) => !have.has(t));
}

const listSchema = z.object({
  webhookSubscriptions: z.object({
    edges: z.array(
      z.object({
        node: z.object({
          id: z.string(),
          topic: z.string(),
          endpoint: z
            .object({ callbackUrl: z.string().nullable().optional() })
            .nullable()
            .optional(),
        }),
      }),
    ),
  }),
});

const createSchema = z.object({
  webhookSubscriptionCreate: z.object({
    webhookSubscription: z.object({ id: z.string() }).nullable(),
    userErrors: z.array(z.object({ message: z.string() })),
  }),
});

export interface EnsureResult {
  created: string[];
  alreadyPresent: string[];
}

export async function ensureWebhooks(
  client: ShopifyClient,
  callbackUrl: string,
): Promise<EnsureResult> {
  const list = await client.request(
    `{
      webhookSubscriptions(first: 100) {
        edges { node {
          id
          topic
          endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } }
        } }
      }
    }`,
    undefined,
    listSchema,
  );

  const existing: ExistingSubscription[] = list.webhookSubscriptions.edges.map(
    (e) => ({ topic: e.node.topic, callbackUrl: e.node.endpoint?.callbackUrl ?? null }),
  );

  const toCreate = topicsToCreate(REQUIRED_TOPICS, existing, callbackUrl);

  const mutation = `mutation Create($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
      webhookSubscription { id }
      userErrors { message }
    }
  }`;

  for (const topic of toCreate) {
    const res = await client.request(
      mutation,
      { topic, sub: { callbackUrl, format: "JSON" } },
      createSchema,
    );
    const errs = res.webhookSubscriptionCreate.userErrors;
    if (errs.length > 0) {
      throw new Error(
        `Failed to register ${topic}: ${errs.map((e) => e.message).join("; ")}`,
      );
    }
  }

  return {
    created: toCreate,
    alreadyPresent: REQUIRED_TOPICS.filter((t) => !toCreate.includes(t)),
  };
}
