import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import { complaintEvents, complaints, flats, notifications, users } from "@/db/schema";
import { testDb } from "@/db/testing";
import { classifyByRules } from "./complaints";
import { createComplaint, decide, refineWithAi, type AiTriage } from "./triage";

const ai = (x: Partial<AiTriage>): AiTriage => ({ category: "Plumbing", urgency: "MEDIUM", confidence: 90, duplicate_of: null, title: "Leak", ...x });

describe("combining the AI with the rules", () => {
  it("lets the AI refine the category", () => {
    expect(decide(classifyByRules("The thing near my door is broken again"), ai({ category: "Civil", confidence: 82 }), [])).toMatchObject({ category: "Civil", by: "AI", needsTriage: false });
  });

  it("escalates safety words even when the AI calls it routine", () => {
    const d = decide(classifyByRules("Slight smell of gas in the lobby"), ai({ category: "Other", urgency: "LOW", confidence: 70 }), []);
    expect(d).toMatchObject({ urgency: "EMERGENCY", safety: true });
  });

  it("sends low-confidence answers to the help desk's triage list", () => {
    expect(decide(classifyByRules("same as last week"), ai({ category: "Plumbing", confidence: 41 }), []).needsTriage).toBe(true);
  });

  it("only links to a complaint it was shown", () => {
    expect(decide(classifyByRules("lift down"), ai({ category: "Lift", duplicate_of: 7 }), [7, 9]).duplicateOf).toBe(7);
    expect(decide(classifyByRules("lift down"), ai({ category: "Lift", duplicate_of: 99 }), [7, 9]).duplicateOf).toBeNull();
  });

  it("falls back to the rules when the AI is unavailable", () => {
    expect(decide(classifyByRules("Water leaking from the bathroom ceiling"), null, [])).toMatchObject({ category: "Plumbing", by: "RULES" });
  });
});

describe("a complaint's life", () => {
  let db: DB;
  let resident: number;
  let manager: number;
  beforeAll(async () => {
    db = await testDb();
    await db.insert(flats).values([
      { id: "T14-0802", tower: 14, floor: 8, unit: 2, areaSqft: 1150 },
      { id: "T14-0305", tower: 14, floor: 3, unit: 5, areaSqft: 1040 },
    ]);
    [{ id: resident }] = await db.insert(users).values({ name: "Ritu Rao", phone: "9700000001" }).returning({ id: users.id });
    [{ id: manager }] = await db.insert(users).values({ name: "Anil Jadhav", phone: "9800000013", role: "MANAGER" }).returning({ id: users.id });
    await db.insert(users).values([
      { name: "Kiran Mane", phone: "9800000105", role: "TECHNICIAN", team: "Lift" },
      { name: "Rahul Thorat", phone: "9800000106", role: "TECHNICIAN", team: "Lift" },
    ]);
  });

  it("is assigned and escalated instantly by rule, before any AI call", async () => {
    const id = await createComplaint(db, { flatId: "T14-0802", raisedBy: resident, description: "My father is stuck in lift A between floors", photoId: null });
    const [c] = await db.select().from(complaints).where(eq(complaints.id, id));
    expect(c).toMatchObject({ category: "Lift", urgency: "EMERGENCY", safety: true, status: "ASSIGNED" });
    expect(await db.select().from(notifications).where(eq(notifications.userId, manager))).toHaveLength(1);
  });

  it("spreads jobs across the team and links the next report of the same lift", async () => {
    const first = (await db.select().from(complaints))[0];
    const id = await createComplaint(db, { flatId: "T14-0305", raisedBy: resident, description: "लिफ्ट बंद आहे", photoId: null });
    await refineWithAi(db, id, async (_, __, candidates) => ai({ category: "Lift", urgency: "HIGH", duplicate_of: candidates[0]?.id ?? null, title: "Lift A not working" }));
    const [c] = await db.select().from(complaints).where(eq(complaints.id, id));
    expect(c).toMatchObject({ parentId: first.id, classifiedBy: "AI", title: "Lift A not working", status: "ASSIGNED" });
    expect(c.assignedTo).not.toBe(first.assignedTo); // least-loaded technician
    const kinds = (await db.select({ k: complaintEvents.kind }).from(complaintEvents).where(eq(complaintEvents.complaintId, id))).map((e) => e.k);
    expect(kinds).toContain("LINKED");
  });

  it("keeps the rules' answer when the AI is down", async () => {
    const id = await createComplaint(db, { flatId: "T14-0305", raisedBy: resident, description: "Lift B making a grinding noise", photoId: null });
    await refineWithAi(db, id, async () => null);
    const [c] = await db.select().from(complaints).where(eq(complaints.id, id));
    expect(c).toMatchObject({ category: "Lift", classifiedBy: "RULES" });
  });
});
