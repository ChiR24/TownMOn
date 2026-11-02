import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Q } from "@/db";
import { complaintEvents, complaints, flatMembers, notifications, users } from "@/db/schema";
import { linkedIds } from "./triage";

type UpdateIntent = "note" | "start" | "resolve";

/** Tells everyone in the flats behind these complaints, with a link to the complaint: one query, one insert. */
async function tellResidents(q: Q, complaintIds: number[], title: string, body: string | null) {
  const rows = await q
    .select({ complaintId: complaints.id, userId: users.id })
    .from(complaints)
    .innerJoin(flatMembers, and(eq(flatMembers.flatId, complaints.flatId), eq(flatMembers.active, true)))
    .innerJoin(users, and(eq(users.id, flatMembers.userId), eq(users.active, true)))
    .where(inArray(complaints.id, complaintIds));
  if (rows.length) await q.insert(notifications).values(rows.map((r) => ({ userId: r.userId, title: `Complaint #${r.complaintId}: ${title}`, body, link: `/complaints/${r.complaintId}` })));
}

/**
 * A help-desk update: a note, "work started" or "fixed". The first human update stops the response clock. "Fixed"
 * asks the resident to confirm and rate; it never closes the complaint for them. Linked duplicates get the same update.
 * Returns false when there was nothing to say.
 */
export async function postUpdate(q: Q, { id, actorId, intent, note, now = new Date() }: { id: number; actorId: number; intent: UpdateIntent; note?: string; now?: Date }) {
  const text = note?.trim() || (intent === "start" ? "Work has started" : intent === "resolve" ? "Fixed. Please confirm it works." : "");
  if (!text) return false;
  const status = intent === "start" ? "IN_PROGRESS" : intent === "resolve" ? "RESOLVED" : undefined;
  const done = await q.transaction(async (tx) => {
    const ids = [id, ...(await linkedIds(tx, id))];
    const changed: number[] = [];
    for (const cid of ids) {
      // A plain note changes no status. "Start" and "fixed" only move an open complaint: one already fixed or
      // closed (say, from a second help-desk screen) gets no second event and its residents no second message.
      if (status) {
        const [hit] = await tx
          .update(complaints)
          .set({ status, ...(status === "RESOLVED" ? { resolvedAt: now } : {}) })
          .where(and(eq(complaints.id, cid), inArray(complaints.status, ["OPEN", "ASSIGNED", "IN_PROGRESS"])))
          .returning({ id: complaints.id });
        if (!hit) continue;
      }
      await tx.update(complaints).set({ firstResponseAt: now }).where(and(eq(complaints.id, cid), isNull(complaints.firstResponseAt)));
      await tx.insert(complaintEvents).values({ complaintId: cid, actorId, kind: "STATUS", note: cid === id ? text : `Update on #${id}: ${text}` });
      changed.push(cid);
    }
    if (changed.length) await tellResidents(tx, changed, intent === "resolve" ? "fixed? Please confirm" : intent === "start" ? "work started" : "update", text);
    return changed;
  });
  return done.length > 0;
}
