import { describe, it, expect } from "vitest";

import {
  aggregateAdRows,
  normalizeChannel,
  parseAdSpendCsv,
} from "../../lib/ads/csv";

describe("normalizeChannel", () => {
  it("maps common platform names to channels", () => {
    expect(normalizeChannel("Google Ads")).toBe("GOOGLE");
    expect(normalizeChannel("adwords")).toBe("GOOGLE");
    expect(normalizeChannel("Facebook")).toBe("META");
    expect(normalizeChannel("meta")).toBe("META");
    expect(normalizeChannel("TikTok")).toBe("TIKTOK");
    expect(normalizeChannel("Pinterest")).toBe("OTHER");
  });
});

describe("parseAdSpendCsv", () => {
  const csv = [
    "date,channel,campaign,spend,clicks,impressions,conversions",
    "2026-06-01,Google,Search - Brand,$45.50,120,3000,6",
    "2026-06-01,Facebook,Advantage+,30.00,80,5000,4",
    "2026-06-02,tiktok,Spark Ads,12.25,40,2000,1",
    "bad-date,Google,x,10,1,1,1",
  ].join("\n");

  it("parses rows, normalizing channel and converting money to cents", () => {
    const { rows, errors } = parseAdSpendCsv(csv);
    expect(rows).toHaveLength(3); // the bad-date row is skipped
    expect(errors).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      channel: "GOOGLE",
      campaignName: "Search - Brand",
      spendCents: 4550,
      clicks: 120,
      conversions: 6,
    });
    expect(rows[1].channel).toBe("META");
    expect(rows[2].channel).toBe("TIKTOK");
  });

  it("requires date, channel, and spend columns", () => {
    const { rows, errors } = parseAdSpendCsv("foo,bar\n1,2");
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/date, channel, and spend/);
  });
});

describe("aggregateAdRows", () => {
  it("sums metrics per day+channel and merges campaign names", () => {
    const csv = [
      "date,channel,campaign,spend,clicks,impressions,conversions",
      "2026-06-01,Google,Brand,$40,100,2000,5",
      "2026-06-01,Google,Generic,$20,50,1500,2",
      "2026-06-01,Meta,Retarget,$30,60,3000,3",
    ].join("\n");

    const { rows } = parseAdSpendCsv(csv);
    const agg = aggregateAdRows(rows);

    const google = agg.find((r) => r.channel === "GOOGLE")!;
    expect(agg).toHaveLength(2); // Google (merged) + Meta
    expect(google.spendCents).toBe(6000); // 40 + 20
    expect(google.clicks).toBe(150);
    expect(google.campaignName).toBe("Brand +1 more");
  });
});
