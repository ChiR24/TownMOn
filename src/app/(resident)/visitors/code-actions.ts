"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { guestCodes } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { createGuestCode } from "@/lib/gate";

export type CodeState = { code?: string; guestName?: string; validTo?: string; error?: string };
const Input = z.object({ guestName: z.string().trim().min(2).max(60), hours: z.enum(["4", "24", "72"]) });

export async function makeCode(_: CodeState, form: FormData): Promise<CodeState> {
  const { user, flat } = await requireResident();
  const p = Input.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "name" };
  const r = await createGuestCode(db, { flatId: flat.flatId, createdBy: user.id, guestName: p.data.guestName, hours: Number(p.data.hours) });
  revalidatePath("/visitors");
  return { code: r.code, guestName: p.data.guestName, validTo: r.validTo.toISOString() };
}

export async function revokeCode(id: number) {
  const { flat } = await requireResident();
  await db.update(guestCodes).set({ revokedAt: new Date() }).where(and(eq(guestCodes.id, id), eq(guestCodes.flatId, flat.flatId), isNull(guestCodes.usedAt)));
  revalidatePath("/visitors");
}
