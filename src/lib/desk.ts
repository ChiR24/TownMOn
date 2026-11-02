import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Q } from "@/db";
import { complaintEvents, complaints, notifications } from "@/db/schema";
import { flatPeople } from "./data";
import { linkedIds } from "./triage";

export type UpdateIntent = "note" | "start" | "resolve";

/** Tells everyone in the flats behind these complaints, with a link to the complaint. */
export async function tellResidents(q: Q, complaintIds: number[], title: string, body: string | null) {
  const rows = await q.select({ id: complaints.id, flatId: complaints.flatId }).from(complaints).where(inArray(complaints.id, complaintIds));
  for (const r of rows) {
    const people = await flatPeople(r.flatId, q);
    if (people.length) await q.insert(notifications).values(people.map((p) => ({ userId: p.id, title: `Complaint #${r.id}: ${title}`, body, link: `/complaints/${r.id}` })));
  }
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
  await q.transaction(async (tx) => {
    const ids = [id, ...(await linkedIds(tx, id))];
    for (const cid of ids) {
      // A plain note changes no status (and an empty update is an error), so only "start" and "fixed" touch it.
      if (status)
        await tx
          .update(complaints)
          .set({ status, ...(status === "RESOLVED" ? { resolvedAt: now } : {}) })
          .where(and(eq(complaints.id, cid), inArray(complaints.status, ["OPEN", "ASSIGNED", "IN_PROGRESS"])));
      await tx.update(complaints).set({ firstResponseAt: now }).where(and(eq(complaints.id, cid), isNull(complaints.firstResponseAt)));
      await tx.insert(complaintEvents).values({ complaintId: cid, actorId, kind: "STATUS", note: cid === id ? text : `Update on #${id}: ${text}` });
    }
    await tellResidents(tx, ids, intent === "resolve" ? "fixed? Please confirm" : intent === "start" ? "work started" : "update", text);
  });
  return true;
}
