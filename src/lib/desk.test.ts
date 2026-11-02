import { eq } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";
import type { DB } from "@/db";
import { complaintEvents, complaints, flatMembers, flats, notifications, users } from "@/db/schema";
import { testDb } from "@/db/testing";
import { postUpdate } from "./desk";

let db: DB;
let desk: number;
let parent: number;
let child: number;

beforeAll(async () => {
  db = await testDb();
  await db.insert(flats).values([
    { id: "T14-0802", tower: 14, floor: 8, unit: 2, areaSqft: 980 },
    { id: "T14-0305", tower: 14, floor: 3, unit: 5, areaSqft: 980 },
  ]);
  const [a, b, d] = await db
    .insert(users)
    .values([
      { name: "Resident A", phone: "9700000001" },
      { name: "Resident B", phone: "9700000002" },
      { name: "Help Desk", phone: "9800000010", role: "HELPDESK" },
    ])
    .returning({ id: users.id });
  desk = d.id;
  await db.insert(flatMembers).values([
    { flatId: "T14-0802", userId: a.id, relation: "OWNER", isPrimary: true },
    { flatId: "T14-0305", userId: b.id, relation: "OWNER", isPrimary: true },
  ]);
  const base = { category: "Lift", urgency: "HIGH" as const, classifiedBy: "AI" as const, status: "ASSIGNED" as const, responseDueAt: new Date(Date.now() + 3_600_000) };
  [{ id: parent }] = await db.insert(complaints).values({ ...base, flatId: "T14-0802", raisedBy: a.id, description: "Lift A not working" }).returning({ id: complaints.id });
  [{ id: child }] = await db.insert(complaints).values({ ...base, flatId: "T14-0305", raisedBy: b.id, description: "T14 lift stopped", parentId: parent }).returning({ id: complaints.id });
});

const statusOf = async (id: number) => (await db.select().from(complaints).where(eq(complaints.id, id)))[0];

it("a plain note keeps the status, stops the response clock and reaches every linked flat", async () => {
  expect(await postUpdate(db, { id: parent, actorId: desk, intent: "note", note: "Vendor on site by 11 am" })).toBe(true);
  for (const id of [parent, child]) {
    const c = await statusOf(id);
    expect(c.status).toBe("ASSIGNED");
    expect(c.firstResponseAt).not.toBeNull();
  }
  const childEvents = await db.select().from(complaintEvents).where(eq(complaintEvents.complaintId, child));
  expect(childEvents.at(-1)?.note).toBe(`Update on #${parent}: Vendor on site by 11 am`);
  expect(await db.select().from(notifications)).toHaveLength(2);
});

it("an empty note does nothing", async () => {
  expect(await postUpdate(db, { id: parent, actorId: desk, intent: "note", note: "   " })).toBe(false);
});

it("start, then fixed: the resident is asked to confirm, never closed for them", async () => {
  await postUpdate(db, { id: parent, actorId: desk, intent: "start" });
  expect((await statusOf(child)).status).toBe("IN_PROGRESS");
  await postUpdate(db, { id: parent, actorId: desk, intent: "resolve" });
  const c = await statusOf(parent);
  expect(c.status).toBe("RESOLVED");
  expect(c.resolvedAt).not.toBeNull();
  expect((await statusOf(child)).status).toBe("RESOLVED");
});
