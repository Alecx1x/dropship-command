"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";

/** Mark a task as placed with the supplier (ordered, awaiting tracking). */
export async function markTaskPlaced(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;
  await prisma.fulfillmentTask.update({
    where: { id: taskId },
    data: { status: "PLACED" },
  });
  revalidatePath("/fulfillment");
}

/**
 * Capture tracking and mark the task shipped, reflecting fulfilled on the order.
 *
 * NOTE: pushing the fulfillment + tracking back to Shopify (fulfillmentCreateV2)
 * needs the order's fulfillmentOrder GIDs, which we don't fetch yet — that
 * Shopify push is a follow-up. Locally we record tracking and mark fulfilled.
 */
export async function markTaskShipped(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "");
  const trackingNumber = String(formData.get("trackingNumber") ?? "").trim();
  const carrier = String(formData.get("carrier") ?? "").trim();
  if (!taskId) return;

  const task = await prisma.fulfillmentTask.update({
    where: { id: taskId },
    data: {
      status: "SHIPPED",
      trackingNumber: trackingNumber || null,
      carrier: carrier || null,
    },
  });

  await prisma.order.update({
    where: { id: task.orderId },
    data: { fulfillmentStatus: "fulfilled" },
  });

  revalidatePath("/fulfillment");
  revalidatePath("/");
}
