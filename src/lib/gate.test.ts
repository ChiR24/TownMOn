import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import { flatMembers, flats, notifications, photos, users, visitors } from "@/db/schema";
import { testDb } from "@/db/testing";
import { codesForTablet, createGuestCode, logVisitor, offlineHashOf, purgeVisitorPhotos, redeemCode } from "./gate";

let db: DB;
let resident: number;
let guard: number;
beforeAll(async () => {
  db = await testDb();
  await db.insert(flats).values({ id: "T07-1203", tower: 7, floor: 12, unit: 3, areaSqft: 1150 });
  [{ id: resident }, { id: guard }] = await db
    .insert(users)
    .values([
      { name: "Neeraj Kulkarni", phone: "9800000001" },
      { name: "Ramesh Pawar", phone: "9800000014", role: "GUARD" },
    ])
    .returning({ id: users.id });
  await db.insert(flatMembers).values({ flatId: "T07-1203", userId: resident, relation: "OWNER", isPrimary: true });
});

const entry = (x: object = {}) => ({ clientId: crypto.randomUUID(), flatId: "T07-1203", name: "Imran (Swiggy)", purpose: "DELIVERY" as const, gate: 1, arrivedAt: new Date(), outcome: "PENDING" as const, phone: "", ...x });

describe("the gate", () => {
  it("records an entry once even if a flaky network sends it twice, and pings the household", async () => {
    const e = entry();
    const a = await logVisitor(db, e, guard, null);
    const b = await logVisitor(db, e, guard, null);
    expect(b).toEqual({ id: (a as { id: number }).id, duplicate: true });
    const pings = await db.select().from(notifications).where(eq(notifications.userId, resident));
    expect(pings.map((p) => p.channel).sort()).toEqual(["APP", "WHATSAPP"]);
  });

  it("keeps the intercom decision made while offline", async () => {
    const r = await logVisitor(db, entry({ outcome: "INTERCOM_APPROVED", arrivedAt: new Date(Date.now() - 3_600_000) }), guard, null);
    const [v] = await db.select().from(visitors).where(eq(visitors.id, (r as { id: number }).id));
    expect(v).toMatchObject({ status: "INSIDE", approvalMode: "INTERCOM" });
  });

  it("lets a guest in once with their code, inside its window", async () => {
    const { code } = await createGuestCode(db, { flatId: "T07-1203", createdBy: resident, guestName: "Kavya (niece)", hours: 24 });
    expect(await redeemCode(db, code, 1, guard)).toMatchObject({ ok: true, flatId: "T07-1203", guestName: "Kavya (niece)" });
    expect(await redeemCode(db, code, 1, guard)).toEqual({ error: "used" });
    expect(await redeemCode(db, "000000" === code ? "111111" : "000000", 1, guard)).toEqual({ error: "invalid" });
    const old = await createGuestCode(db, { flatId: "T07-1203", createdBy: resident, guestName: "Asha", hours: 1, now: new Date(Date.now() - 7_200_000) });
    expect(await redeemCode(db, old.code, 1, guard)).toEqual({ error: "expired" });
  });

  it("gives tablets salted hashes they can check offline, never the codes", async () => {
    const { code } = await createGuestCode(db, { flatId: "T07-1203", createdBy: resident, guestName: "Rahul", hours: 5 });
    const list = await codesForTablet(db);
    const hit = list.find((c) => c.hash === offlineHashOf(c.salt, code));
    expect(hit?.guestName).toBe("Rahul");
    expect(JSON.stringify(list)).not.toContain(code);
  });

  it("deletes visitor photos after 90 days but keeps the visit", async () => {
    const [p] = await db.insert(photos).values({ mime: "image/jpeg", bytes: Buffer.from([0xff, 0xd8, 0xff]) }).returning({ id: photos.id });
    const r = await logVisitor(db, entry({ arrivedAt: new Date(Date.now() - 91 * 86_400_000) }), guard, p.id);
    expect(await purgeVisitorPhotos(db)).toBe(1);
    const [v] = await db.select().from(visitors).where(eq(visitors.id, (r as { id: number }).id));
    expect(v.photoId).toBeNull();
    expect(v.photoPurgedAt).not.toBeNull();
    expect(await db.select().from(photos)).toHaveLength(0);
  });
});
