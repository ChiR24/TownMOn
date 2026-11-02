"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { visitors } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isMember } from "@/lib/data";

// A server action's arguments come from the browser, bound or not: checked like any other input.
const Decision = z.tuple([z.number().int().positive(), z.enum(["APPROVED", "DENIED"])]);

/** A resident lets a waiting visitor in, or not. Only for their own flat, and only while still waiting. */
export async function decideVisitor(visitorId: number, decision: "APPROVED" | "DENIED") {
  const user = await requireUser(["RESIDENT"]);
  const args = Decision.safeParse([visitorId, decision]);
  if (!args.success) return;
  const [id, status] = args.data;
  const [v] = await db.select({ flatId: visitors.flatId }).from(visitors).where(eq(visitors.id, id));
  if (!v || !(await isMember(user.id, v.flatId))) return;
  await db
    .update(visitors)
    .set({ status, approvalMode: "APP", decidedBy: user.id, decidedAt: new Date() })
    .where(and(eq(visitors.id, id), eq(visitors.status, "PENDING")));
  revalidatePath("/");
  revalidatePath("/visitors");
}
