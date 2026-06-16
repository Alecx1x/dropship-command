import { describe, it, expect } from "vitest";

import { canAccessPath, landingPathFor } from "../../lib/auth/roles";

describe("role access", () => {
  it("lets the owner reach every route", () => {
    for (const p of ["/", "/profit", "/research", "/stores", "/fulfillment", "/sync"]) {
      expect(canAccessPath("OWNER", p)).toBe(true);
    }
  });

  it("limits a VA to the fulfillment queue", () => {
    expect(canAccessPath("VA", "/fulfillment")).toBe(true);
    expect(canAccessPath("VA", "/fulfillment/anything")).toBe(true);
  });

  it("blocks a VA from owner-only routes", () => {
    for (const p of ["/", "/profit", "/research", "/reviews", "/stores", "/sync", "/alerts"]) {
      expect(canAccessPath("VA", p)).toBe(false);
    }
  });

  it("does not let a VA reach a lookalike prefix", () => {
    // "/fulfillment-secrets" must not match the "/fulfillment" prefix.
    expect(canAccessPath("VA", "/fulfillment-secrets")).toBe(false);
  });

  it("routes each role to its landing page", () => {
    expect(landingPathFor("OWNER")).toBe("/");
    expect(landingPathFor("VA")).toBe("/fulfillment");
  });
});
