"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, type Q } from "@/db";
import { complaintEvents, complaints, notices, notifications, users } from "@/db/schema";
import { AREAS, requireUser } from "@/lib/auth";
import { CATEGORIES, responseDue, teamFor, URGENCIES, URGENCY_LABEL, type Category, type Urgency } from "@/lib/complaints";
import { flatPeople } from "@/lib/data";
import { linkedIds, pickTechnician } from "@/lib/triage";

const desk = () => requireUser(AREAS.desk);
const refresh = (id: number) => {
  revalidatePath("/desk");
  revalidatePath(`/desk/complaints/${id}`);
};

async function tellResidents(q: Q, complaintIds: number[], title: string, body: string | null) {
  const rows = await q.select({ id: complaints.id, flatId: complaints.flatId }).from(complaints).where(inArray(complaints.id, complaintIds));
  for (const r of rows) {
    const people = await flatPeople(r.flatId, q);
    if (people.length) await q.insert(notifications).values(people.map((p) => ({ userId: p.id, title: `Complaint #${r.id}: ${title}`, body, link: `/complaints/${r.id}` })));
  }
}

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
  await db.update(complaints).set({ assignedTo: tech.id, status: "ASSIGNED" }).where(and(eq(complaints.id, id), inArray(complaints.status, ["OPEN", "ASSIGNED"])));
  await db.insert(complaintEvents).values({ complaintId: id, actorId: user.id, kind: "ASSIGNED", note: `Assigned to ${tech.name}` });
  refresh(id);
}

const Update = z.object({ intent: z.enum(["note", "start", "resolve"]), note: z.string().trim().max(500).optional() });

/**
 * Status updates and notes. The first human update stops the response clock. "Fixed" asks the resident to
 * confirm and rate; it never closes the complaint for them. Linked duplicates get the same update.
 */
export async function update(id: number, form: FormData) {
  const user = await desk();
  const { intent, note } = Update.parse(Object.fromEntries(form));
  const text = note || (intent === "start" ? "Work has started" : intent === "resolve" ? "Fixed. Please confirm it works." : "");
  if (!text) return;
  const now = new Date();
  await db.transaction(async (tx) => {
    const ids = [id, ...(await linkedIds(tx, id))];
    const status = intent === "start" ? "IN_PROGRESS" : intent === "resolve" ? "RESOLVED" : undefined;
    for (const cid of ids) {
      await tx
        .update(complaints)
        .set({ ...(status ? { status } : {}), ...(status === "RESOLVED" ? { resolvedAt: now } : {}) })
        .where(and(eq(complaints.id, cid), inArray(complaints.status, ["OPEN", "ASSIGNED", "IN_PROGRESS"])));
      await tx.update(complaints).set({ firstResponseAt: now }).where(and(eq(complaints.id, cid), isNull(complaints.firstResponseAt)));
      await tx.insert(complaintEvents).values({ complaintId: cid, actorId: user.id, kind: "STATUS", note: cid === id ? text : `Update on #${id}: ${text}` });
    }
    await tellResidents(tx, ids, intent === "resolve" ? "fixed? Please confirm" : intent === "start" ? "work started" : "update", text);
  });
  refresh(id);
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

const Notice = z.object({ title: z.string().trim().min(5).max(120), body: z.string().trim().min(5).max(1500), tower: z.string() });

export async function postNotice(_: { error?: string; ok?: boolean }, form: FormData) {
  const user = await desk();
  const p = Notice.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Give the notice a title and a few lines of text." };
  const tower = p.data.tower === "all" ? null : z.coerce.number().int().min(1).max(28).parse(p.data.tower);
  await db.insert(notices).values({ title: p.data.title, body: p.data.body, tower, createdBy: user.id });
  revalidatePath("/desk/notices");
  return { ok: true };
}
