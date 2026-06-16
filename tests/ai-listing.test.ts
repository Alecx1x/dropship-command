import { describe, it, expect, vi } from "vitest";

import {
  buildListingPrompt,
  generateListingCopy,
  LISTING_SYSTEM_PROMPT,
  LISTING_TOOL,
  parseListingCopy,
  RSA_DESCRIPTION_MAX,
  RSA_HEADLINE_MAX,
  type RunListing,
} from "../lib/ai/listing";

describe("buildListingPrompt", () => {
  it("includes product, price, and the RSA character limits", () => {
    const prompt = buildListingPrompt({
      title: "Neck Fan",
      niche: "summer",
      estPriceCents: 2995,
      evidence: "scored 72",
    });
    expect(prompt).toContain("Neck Fan");
    expect(prompt).toContain("$29.95");
    expect(prompt).toContain(String(RSA_HEADLINE_MAX));
    expect(prompt).toContain(String(RSA_DESCRIPTION_MAX));
    expect(prompt).toContain("submit_listing");
  });
});

function rawListing() {
  return {
    title: "  Portable Neck Fan  ",
    description: "  Stay cool anywhere.  ",
    adAngles: ["Beat the heat", "Hands-free cooling", "", "Great for commutes"],
    rsaSets: [
      {
        headlines: [
          "This headline is definitely way too long for Google", // > 30
          "Cool Down Fast",
          "  ",
        ],
        descriptions: [
          "A short description.",
          "x".repeat(120), // > 90
        ],
      },
      { headlines: ["Set Two Headline"], descriptions: ["Desc two"] },
      { headlines: ["Set Three Headline"], descriptions: ["Desc three"] },
      { headlines: ["Set Four — should be dropped"], descriptions: ["Nope"] },
    ],
  };
}

describe("parseListingCopy", () => {
  it("trims, drops empties, and caps counts/lengths to Google limits", () => {
    const copy = parseListingCopy(rawListing());

    expect(copy.title).toBe("Portable Neck Fan");
    expect(copy.description).toBe("Stay cool anywhere.");

    // empties dropped, capped at 5
    expect(copy.adAngles).toEqual([
      "Beat the heat",
      "Hands-free cooling",
      "Great for commutes",
    ]);

    // only 3 sets survive
    expect(copy.rsaSets).toHaveLength(3);

    // headline truncated to <=30, blank dropped
    for (const set of copy.rsaSets) {
      for (const h of set.headlines) expect(h.length).toBeLessThanOrEqual(RSA_HEADLINE_MAX);
      for (const d of set.descriptions)
        expect(d.length).toBeLessThanOrEqual(RSA_DESCRIPTION_MAX);
    }
    expect(copy.rsaSets[0].headlines).toContain("Cool Down Fast");
    expect(copy.rsaSets[0].headlines).not.toContain("");
  });

  it("throws on a fundamentally wrong shape", () => {
    expect(() => parseListingCopy(null)).toThrow();
    expect(() => parseListingCopy({ title: 5 })).toThrow();
  });
});

describe("generateListingCopy", () => {
  it("passes the listing system prompt + tool and returns parsed copy", async () => {
    const run: RunListing = vi.fn(async () => rawListing());
    const copy = await generateListingCopy({ title: "Neck Fan" }, run);

    expect(copy.title).toBe("Portable Neck Fan");
    expect(run).toHaveBeenCalledOnce();
    const arg = (run as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.system).toBe(LISTING_SYSTEM_PROMPT);
    expect(arg.tool).toBe(LISTING_TOOL);
    expect(arg.user).toContain("Neck Fan");
  });
});
