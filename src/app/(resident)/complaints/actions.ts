"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { complaintEvents, complaints } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { responseDue, type Urgency } from "@/lib/complaints";
import { isMember } from "@/lib/data";
import { savePhoto } from "@/lib/photos";
import { createComplaint, refineWithAi } from "@/lib/triage";

export type State = { error?: "short" | "photo" | "rating" };

export async function submitComplaint(_: State, form: FormData): Promise<State> {
  const { user, flat } = await requireResident();
  const description = String(form.get("description") ?? "").trim();
  if (description.length < 5 || description.length > 1000) return { error: "short" };
  const photo = form.get("photo");
  const id = await db.transaction(async (tx) => {
    const photoId = photo instanceof File && photo.size > 0 ? await savePhoto(tx, photo) : null;
    if (photo instanceof File && photo.size > 0 && !photoId) return null;
    return createComplaint(tx, { flatId: flat.flatId, raisedBy: user.id, description, photoId });
  });
  if (!id) return { error: "photo" };
  // The resident sees the rules' answer at once; Claude refines it a few seconds later, off the request.
  after(() => refineWithAi(db, id));
  redirect(`/complaints/${id}?new=1`);
}

/** Loads a complaint only if it belongs to the signed-in resident's flat and is waiting for their confirmation. */
async function resolvedForMe(id: number) {
  const { user } = await requireResident();
  const [c] = await db.select().from(complaints).where(eq(complaints.id, id));
  if (!c || c.status !== "RESOLVED" || !(await isMember(user.id, c.flatId))) return null;
  return { c, user };
}

export async function closeWithRating(id: number, _: State, form: FormData): Promise<State> {
  const rating = z.coerce.number().int().min(1).max(5).safeParse(form.get("rating"));
  if (!rating.success) return { error: "rating" };
  const found = await resolvedForMe(id);
  if (!found) return {};
  const comment = String(form.get("comment") ?? "").trim().slice(0, 500) || null;
  await db.update(complaints).set({ status: "CLOSED", closedAt: new Date(), rating: rating.data, ratingComment: comment }).where(eq(complaints.id, id));
  await db.insert(complaintEvents).values({ complaintId: id, actorId: found.user.id, kind: "RATED", note: `${"★".repeat(rating.data)} Rated ${rating.data}/5${comment ? `: ${comment}` : ""}` });
  revalidatePath(`/complaints/${id}`);
  return {};
}

/** "Not fixed": back to the technician with a fresh response clock. Counted, because reopen rate is a target. */
export async function reopen(id: number) {
  const found = await resolvedForMe(id);
  if (!found) return;
  const { c, user } = found;
  await db
    .update(complaints)
    .set({ status: c.assignedTo ? "ASSIGNED" : "OPEN", reopenCount: c.reopenCount + 1, resolvedAt: null, firstResponseAt: null, responseDueAt: responseDue(c.urgency as Urgency) })
    .where(and(eq(complaints.id, id), eq(complaints.status, "RESOLVED")));
  await db.insert(complaintEvents).values({ complaintId: id, actorId: user.id, kind: "REOPENED", note: "Resident says it is not fixed" });
  revalidatePath(`/complaints/${id}`);
}
