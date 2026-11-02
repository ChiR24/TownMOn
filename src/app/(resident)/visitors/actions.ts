"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { visitors } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isMember } from "@/lib/data";

/** A resident lets a waiting visitor in, or not. Only for their own flat, and only while still waiting. */
export async function decideVisitor(visitorId: number, decision: "APPROVED" | "DENIED") {
  const user = await requireUser(["RESIDENT"]);
  const [v] = await db.select({ flatId: visitors.flatId, status: visitors.status }).from(visitors).where(eq(visitors.id, visitorId));
  if (!v || !(await isMember(user.id, v.flatId))) return;
  await db
    .update(visitors)
    .set({ status: decision, approvalMode: "APP", decidedBy: user.id, decidedAt: new Date() })
    .where(and(eq(visitors.id, visitorId), eq(visitors.status, "PENDING")));
  revalidatePath("/");
  revalidatePath("/visitors");
}
