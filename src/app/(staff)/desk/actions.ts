"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { complaintEvents, complaints, notices, users } from "@/db/schema";
import { AREAS, requireUser } from "@/lib/auth";
import { CATEGORIES, responseDue, teamFor, URGENCIES, URGENCY_LABEL, type Category, type Urgency } from "@/lib/complaints";
import { postUpdate } from "@/lib/desk";
import { pickTechnician } from "@/lib/triage";

const desk = () => requireUser(AREAS.desk);
const refresh = (id: number) => {
  revalidatePath("/desk");
  revalidatePath(`/desk/complaints/${id}`);
};

/** One tap fixes the AI's category. Counted, so the committee can see how often the AI is corrected. */
export async function setCategory(id: number, category: string) {
  const user = await desk();
  const cat = z.enum(CATEGORIES).parse(category);
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(complaints).where(eq(complaints.id, id)).for("update");
    if (!c || c.category === cat) return;
    const reassign = teamFor(cat) !== teamFor(c.category as Category) && c.status !== "IN_PROGRESS" && c.status !== "RESOLVED" && c.status !== "CLOSED";
    const tech = reassign ? await pickTechnician(tx, cat) : undefined;
    await tx
      .update(complaints)
      .set({ category: cat, classifiedBy: "STAFF", needsTriage: false, ...(tech !== undefined ? { assignedTo: tech?.id ?? null, status: tech ? "ASSIGNED" : "OPEN" } : {}) })
      .where(eq(complaints.id, id));
    const was = c.classifiedBy === "AI" ? ` (AI said ${c.category}, ${c.aiConfidence}% sure)` : ` (was ${c.category})`;
    await tx.insert(complaintEvents).values({ complaintId: id, actorId: user.id, kind: "CATEGORY", note: `Help desk set the category to ${cat}${was}` });
    if (tech) await tx.insert(complaintEvents).values({ complaintId: id, actorId: user.id, kind: "ASSIGNED", note: `Reassigned to ${tech.name}` });
  });
  refresh(id);
}

export async function setUrgency(id: number, form: FormData) {
  const user = await desk();
  const u = z.enum(URGENCIES).parse(form.get("urgency"));
  const [c] = await db.select().from(complaints).where(eq(complaints.id, id));
  if (!c || c.urgency === u) return;
  await db.update(complaints).set({ urgency: u, responseDueAt: responseDue(u, c.createdAt) }).where(eq(complaints.id, id));
  await db.insert(complaintEvents).values({ complaintId: id, actorId: user.id, kind: "URGENCY", note: `Urgency set to ${URGENCY_LABEL[u as Urgency].toLowerCase()}` });
  refresh(id);
}

export async function assign(id: number, form: FormData) {
  const user = await desk();
  const techId = z.coerce.number().int().parse(form.get("techId"));
  const [tech] = await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.id, techId), eq(users.role, "TECHNICIAN")));
  if (!tech) return;
  const [c] = await db.select({ status: complaints.status }).from(complaints).where(eq(complaints.id, id));
  // Any open complaint can change hands (a technician swapped mid-job keeps it "in progress"); fixed or closed can't.
  if (!c || !["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(c.status)) return;
  await db
    .update(complaints)
    .set({ assignedTo: tech.id, ...(c.status === "OPEN" ? { status: "ASSIGNED" as const } : {}) })
    .where(and(eq(complaints.id, id), inArray(complaints.status, ["OPEN", "ASSIGNED", "IN_PROGRESS"])));
  await db.insert(complaintEvents).values({ complaintId: id, actorId: user.id, kind: "ASSIGNED", note: `Assigned to ${tech.name}` });
  refresh(id);
}

const Update = z.object({ intent: z.enum(["note", "start", "resolve"]), note: z.string().trim().max(500).optional() });

/** Status updates and notes (the rules live in lib/desk.ts, where they are tested). */
export async function update(id: number, form: FormData) {
  const user = await desk();
  const { intent, note } = Update.parse(Object.fromEntries(form));
  await postUpdate(db, { id, actorId: user.id, intent, note });
  refresh(id); // even when nothing changed: a stale screen then shows what another desk already did
}

export async function unlink(childId: number) {
  const user = await desk();
  const [c] = await db.select({ parentId: complaints.parentId }).from(complaints).where(eq(complaints.id, childId));
  if (!c?.parentId) return;
  await db.update(complaints).set({ parentId: null }).where(eq(complaints.id, childId));
  await db.insert(complaintEvents).values({ complaintId: childId, actorId: user.id, kind: "LINKED", note: `Help desk unlinked this from #${c.parentId}: a different problem` });
  refresh(childId);
  refresh(c.parentId);
}

const Notice = z.object({ title: z.string().trim().min(5).max(120), body: z.string().trim().min(5).max(1500), tower: z.union([z.literal("all"), z.coerce.number().int().min(1).max(28)]) });
export type NoticeState = { error?: string; ok?: boolean; values?: { title: string; body: string; tower: string } };

export async function postNotice(_: NoticeState, form: FormData): Promise<NoticeState> {
  const user = await desk();
  const values = { title: String(form.get("title") ?? ""), body: String(form.get("body") ?? ""), tower: String(form.get("tower") ?? "all") };
  const p = Notice.safeParse(values);
  if (!p.success) return { error: "Give the notice a title and a few lines of text.", values };
  const tower = p.data.tower === "all" ? null : p.data.tower;
  await db.insert(notices).values({ title: p.data.title, body: p.data.body, tower, createdBy: user.id });
  revalidatePath("/desk/notices");
  return { ok: true };
}
