"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";

export async function markAlertRead(formData: FormData): Promise<void> {
  const id = String(formData.get("alertId") ?? "");
  if (!id) return;
  await prisma.alert.update({
    where: { id },
    data: { readAt: new Date() },
  });
  revalidatePath("/alerts");
  revalidatePath("/");
}

export async function markAllAlertsRead(): Promise<void> {
  await prisma.alert.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/alerts");
  revalidatePath("/");
}
