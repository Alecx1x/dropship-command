import { prisma } from "@/lib/db";

// Node runtime: reads process.env and queries via the Prisma adapter. Off the Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Discovery status — the SONAR feedback wire (read-only).
 *
 * SONAR holds the mapping between its candidates and the ResearchItem ids it
 * created here (via /api/discovery/ingest). It periodically asks "what became of
 * these?" so it can label its past predictions (won/killed) and sharpen scoring.
 * Bearer-token auth (INGEST_TOKEN), excluded from the auth proxy in proxy.ts.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function GET(req: Request): Promise<Response> {
  const token = process.env.INGEST_TOKEN;
  if (!token) return json({ error: "ingest_not_configured" }, 500);
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);
  if (!ids.length) return json({ items: [] });

  const items = await prisma.researchItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, score: true },
  });
  return json({ items });
}
