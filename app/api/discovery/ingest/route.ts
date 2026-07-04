import { z } from "zod";

import { prisma } from "@/lib/db";

// Node runtime: reads process.env and writes via the Prisma adapter. Off the Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Discovery ingest — the SONAR bridge (incorporates the external trend radar).
 *
 * A validated candidate from SONAR's pipeline ("Go") is dropped into the
 * research pipeline as a ResearchItem (status IDEA/TESTING by default), where it
 * picks up the existing Claude scoring + listing flow. Machine-to-machine, so it
 * authenticates with a shared bearer token (INGEST_TOKEN) rather than a session —
 * this path is excluded from the auth proxy in proxy.ts (same idea as the
 * Shopify webhook, which uses HMAC instead of a session).
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;
const optionalDollars = z.preprocess(
  blankToUndefined,
  z.coerce.number().min(0).optional(),
);

const payloadSchema = z.object({
  title: z.string().trim().min(1, "A product title is required."),
  sourceUrl: z.preprocess(
    blankToUndefined,
    z.string().url("Source must be a valid URL.").optional(),
  ),
  niche: z.preprocess(blankToUndefined, z.string().trim().optional()),
  costDollars: optionalDollars, // converted to integer cents (CLAUDE.md rule 4)
  priceDollars: optionalDollars,
  score: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(0).max(100).optional(),
  ),
  scoreRationale: z.preprocess(blankToUndefined, z.string().optional()),
  status: z.enum(["IDEA", "TESTING", "LIVE", "KILLED"]).default("IDEA"),
});

export async function POST(req: Request): Promise<Response> {
  const token = process.env.INGEST_TOKEN;
  if (!token) return json({ error: "ingest_not_configured" }, 500);
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_payload", detail: parsed.error.issues[0]?.message },
      400,
    );
  }
  const d = parsed.data;

  const item = await prisma.researchItem.create({
    data: {
      title: d.title,
      sourceUrl: d.sourceUrl ?? null,
      niche: d.niche ?? null,
      supplierCostCents:
        d.costDollars == null ? null : Math.round(d.costDollars * 100),
      estPriceCents:
        d.priceDollars == null ? null : Math.round(d.priceDollars * 100),
      score: d.score ?? null,
      scoreRationale: d.scoreRationale ?? null,
      status: d.status,
    },
  });

  return json({ ok: true, id: item.id });
}
