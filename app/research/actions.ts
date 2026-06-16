"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runListingWithClaude, runScoringWithClaude } from "@/lib/ai/anthropic";
import { generateListingCopy } from "@/lib/ai/listing";
import { scoreProduct } from "@/lib/ai/score";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Empty form fields arrive as "" — treat those as "not provided". */
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalDollars = z.preprocess(
  blankToUndefined,
  z.coerce.number().min(0).optional(),
);

const intakeSchema = z.object({
  title: z.string().trim().min(1, "A product title is required."),
  sourceUrl: z.preprocess(
    blankToUndefined,
    z.string().url("Source must be a valid URL.").optional(),
  ),
  niche: z.preprocess(blankToUndefined, z.string().trim().optional()),
  costDollars: optionalDollars,
  priceDollars: optionalDollars,
});

export type IntakeState = { error: string } | { ok: true } | undefined;

/**
 * Add a research candidate to the pipeline (SPEC 4.1 intake). Dollar inputs are
 * converted to integer cents (money is always cents — rule 4). Scoring is a
 * separate, explicit step so the owner controls when an Anthropic call is spent.
 */
export async function addResearchItem(
  _prev: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const parsed = intakeSchema.safeParse({
    title: formData.get("title"),
    sourceUrl: formData.get("sourceUrl"),
    niche: formData.get("niche"),
    costDollars: formData.get("costDollars"),
    priceDollars: formData.get("priceDollars"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { title, sourceUrl, niche, costDollars, priceDollars } = parsed.data;
  await prisma.researchItem.create({
    data: {
      title,
      sourceUrl: sourceUrl ?? null,
      niche: niche ?? null,
      supplierCostCents:
        costDollars == null ? null : Math.round(costDollars * 100),
      estPriceCents:
        priceDollars == null ? null : Math.round(priceDollars * 100),
    },
  });

  revalidatePath("/research");
  return { ok: true };
}

export type ScoreState = { error: string } | { ok: true } | undefined;

/**
 * Score one research item with Claude (SPEC 4.1). Runs inline (not via the job
 * queue) because it's a single, interactive request the owner triggers and
 * waits on. The 0–100 score and rationale are persisted on the item.
 */
export async function scoreResearchItem(
  _prev: ScoreState,
  formData: FormData,
): Promise<ScoreState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing item id." };

  const item = await prisma.researchItem.findUnique({ where: { id } });
  if (!item) return { error: "Research item not found." };

  try {
    const { score, rationale } = await scoreProduct(
      {
        title: item.title,
        niche: item.niche,
        supplierCostCents: item.supplierCostCents,
        estPriceCents: item.estPriceCents,
        evidence: item.sourceUrl ? `Source: ${item.sourceUrl}` : null,
      },
      runScoringWithClaude,
    );

    await prisma.researchItem.update({
      where: { id },
      data: { score, scoreRationale: rationale },
    });
  } catch (err) {
    console.error("Scoring failed:", err);
    return {
      error:
        err instanceof Error && err.message.includes("ANTHROPIC_API_KEY")
          ? "ANTHROPIC_API_KEY is not set — add it to .env to score."
          : "Scoring failed. Check the worker/server logs and try again.",
    };
  }

  revalidatePath("/research");
  return { ok: true };
}

const STATUSES = ["IDEA", "TESTING", "LIVE", "KILLED"] as const;
const statusSchema = z.enum(STATUSES);

/** Move an item through the pipeline (IDEA → TESTING → LIVE / KILLED). */
export async function setResearchStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = statusSchema.safeParse(formData.get("status"));
  if (!id || !status.success) return;

  await prisma.researchItem.update({
    where: { id },
    data: { status: status.data },
  });
  revalidatePath("/research");
}

/** Remove a candidate from the pipeline. */
export async function deleteResearchItem(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.researchItem.delete({ where: { id } });
  revalidatePath("/research");
}

export type ListingState = { error: string } | { ok: true } | undefined;

/**
 * Generate (or regenerate) listing copy for a research item with Claude
 * (SPEC 4.2). Runs inline — a single interactive request the owner triggers.
 * The result is stored as a DRAFT (regenerating resets any prior approval); a
 * human approves before anything is published.
 */
export async function generateListing(
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing item id." };

  const item = await prisma.researchItem.findUnique({ where: { id } });
  if (!item) return { error: "Research item not found." };

  try {
    const copy = await generateListingCopy(
      {
        title: item.title,
        niche: item.niche,
        estPriceCents: item.estPriceCents,
        evidence: item.scoreRationale,
      },
      runListingWithClaude,
    );

    const data = {
      title: copy.title,
      description: copy.description,
      adAngles: copy.adAngles,
      rsaSets: copy.rsaSets as unknown as Prisma.InputJsonValue,
      status: "DRAFT" as const,
    };

    await prisma.listingDraft.upsert({
      where: { researchItemId: id },
      create: { researchItemId: id, ...data },
      update: data,
    });
  } catch (err) {
    console.error("Listing generation failed:", err);
    return {
      error:
        err instanceof Error && err.message.includes("ANTHROPIC_API_KEY")
          ? "ANTHROPIC_API_KEY is not set — add it to .env to generate copy."
          : "Generation failed. Check the server logs and try again.",
    };
  }

  revalidatePath(`/research/${id}/listing`);
  return { ok: true };
}

/** Owner sign-off: mark a listing draft approved (publishing is a later phase). */
export async function approveListing(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.listingDraft.update({
    where: { researchItemId: id },
    data: { status: "APPROVED" },
  });
  revalidatePath(`/research/${id}/listing`);
}
