"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { flatMembers, users } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

// `values` sends back what was typed, so a mistake doesn't wipe the form (React resets a form after its action).
export type MemberState = { error?: "name" | "phone" | "taken" | "notPrimary"; ok?: boolean; values?: { name: string; phone: string } };

/** Only the owner or tenant on record manages the household, so nobody can add themselves to a flat. */
export async function addMember(_: MemberState, form: FormData): Promise<MemberState> {
  const { flat } = await requireResident();
  const values = { name: String(form.get("name") ?? ""), phone: String(form.get("phone") ?? "") };
  if (!flat.isPrimary) return { error: "notPrimary" };
  const name = z.string().trim().min(2).max(60).safeParse(values.name);
  if (!name.success) return { error: "name", values };
  const phone = normalizePhone(values.phone);
  if (!phone) return { error: "phone", values };
  // An existing number is never linked silently: that would let one household pull in someone else's account.
  // The one exception is a family member this same household removed earlier: adding them back restores them.
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  if (exists) {
    const [was] = await db
      .select({ id: flatMembers.id })
      .from(flatMembers)
      .where(and(eq(flatMembers.flatId, flat.flatId), eq(flatMembers.userId, exists.id), eq(flatMembers.relation, "FAMILY"), eq(flatMembers.active, false)));
    if (!was) return { error: "taken", values };
    await db.update(flatMembers).set({ active: true }).where(eq(flatMembers.id, was.id));
    revalidatePath("/more");
    return { ok: true };
  }
  await db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ name: name.data, phone }).returning({ id: users.id });
    await tx.insert(flatMembers).values({ flatId: flat.flatId, userId: u.id, relation: "FAMILY" });
  });
  revalidatePath("/more");
  return { ok: true };
}

export async function removeMember(memberId: number) {
  const { flat } = await requireResident();
  if (!flat.isPrimary) return;
  await db
    .update(flatMembers)
    .set({ active: false })
    .where(and(eq(flatMembers.id, memberId), eq(flatMembers.flatId, flat.flatId), eq(flatMembers.isPrimary, false), eq(flatMembers.relation, "FAMILY")));
  revalidatePath("/more");
}
