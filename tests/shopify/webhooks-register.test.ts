import { describe, it, expect } from "vitest";

import {
  REQUIRED_TOPICS,
  topicsToCreate,
  type ExistingSubscription,
} from "../../lib/shopify/webhooks-register";

const CB = "https://app.example.com/api/webhooks/shopify";

describe("topicsToCreate", () => {
  it("creates all topics when none exist", () => {
    expect(topicsToCreate(REQUIRED_TOPICS, [], CB)).toEqual([...REQUIRED_TOPICS]);
  });

  it("creates none when all already point at our callback", () => {
    const existing: ExistingSubscription[] = REQUIRED_TOPICS.map((topic) => ({
      topic,
      callbackUrl: CB,
    }));
    expect(topicsToCreate(REQUIRED_TOPICS, existing, CB)).toEqual([]);
  });

  it("creates only the missing topics", () => {
    const existing: ExistingSubscription[] = [
      { topic: "ORDERS_CREATE", callbackUrl: CB },
      { topic: "APP_UNINSTALLED", callbackUrl: CB },
    ];
    expect(topicsToCreate(REQUIRED_TOPICS, existing, CB)).toEqual([
      "ORDERS_UPDATED",
      "REFUNDS_CREATE",
      "PRODUCTS_UPDATE",
      "INVENTORY_LEVELS_UPDATE",
    ]);
  });

  it("ignores subscriptions pointing at a different callback URL", () => {
    const existing: ExistingSubscription[] = [
      { topic: "ORDERS_CREATE", callbackUrl: "https://old.example.com/hook" },
      { topic: "ORDERS_UPDATED", callbackUrl: null },
    ];
    // Both should still be (re)created at our URL.
    const result = topicsToCreate(REQUIRED_TOPICS, existing, CB);
    expect(result).toContain("ORDERS_CREATE");
    expect(result).toContain("ORDERS_UPDATED");
  });
});
