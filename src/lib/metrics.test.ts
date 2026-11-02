import { beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import { complaints, flats, ledger, payments, users } from "@/db/schema";
import { testDb } from "@/db/testing";
import { monthReport, onTimeTrend } from "./metrics";

let db: DB;
beforeAll(async () => {
  db = await testDb();
  await db.insert(flats).values([
    { id: "A", tower: 1, floor: 1, unit: 1, areaSqft: 1000 },
    { id: "B", tower: 1, floor: 1, unit: 2, areaSqft: 1000 },
  ]);
  const [p1, p2, p3] = await db
    .insert(payments)
    .values([
      { flatId: "A", amount: 650_000, method: "UPI", source: "BANK", paidOn: "2026-10-05" },
      { flatId: "B", amount: 650_000, method: "UPI", source: "GATEWAY", paidOn: "2026-10-20" },
      { flatId: "B", amount: 100_000, method: "NEFT", source: "BANK", paidOn: "2026-10-25" },
    ])
    .returning({ id: payments.id });
  await db.insert(ledger).values([
    { flatId: "A", kind: "MAINTENANCE", amount: 650_000, date: "2026-10-01", dueDate: "2026-10-15" },
    { flatId: "B", kind: "MAINTENANCE", amount: 650_000, date: "2026-10-01", dueDate: "2026-10-15" },
    { flatId: "A", kind: "PAYMENT", amount: -650_000, date: "2026-10-05", paymentId: p1.id },
    { flatId: "B", kind: "PAYMENT", amount: -650_000, date: "2026-10-20", paymentId: p2.id }, // late
    { flatId: "B", kind: "PAYMENT", amount: -100_000, date: "2026-10-25", paymentId: p3.id },
    { flatId: "B", kind: "REVERSAL", amount: 100_000, date: "2026-10-28", paymentId: p3.id }, // wrong flat, reversed
    { flatId: "A", kind: "MAINTENANCE", amount: 650_000, date: "2026-11-01", dueDate: "2026-11-15" },
  ]);
});

describe("the committee's monthly report", () => {
  it("reconciles: opening + billed + reversed − collected = closing, to the paisa", async () => {
    const r = await monthReport(db, "2026-10", "2026-11-20");
    expect(r.money).toMatchObject({ opening: 0, billedTotal: 1_300_000, collected: 1_400_000, reversed: 100_000, closing: 0, difference: 0 });
    expect(r.collectionRate).toBeCloseTo(107.7, 1);
  });

  it("counts a bill on time only if it was fully paid by the 15th", async () => {
    expect((await monthReport(db, "2026-10", "2026-11-20")).onTime).toBe(50);
    expect((await monthReport(db, "2026-11", "2026-11-10")).onTime).toBeNull(); // not due yet
  });

  it("shows the trend only for months whose due date has passed", async () => {
    expect(await onTimeTrend(db, 2, "2026-11-20")).toEqual([
      { period: "2026-10", rate: 50 },
      { period: "2026-11", rate: 0 },
    ]);
  });

  it("counts AI corrections only among calls the AI made", async () => {
    const [u] = await db.insert(users).values({ name: "Resident", phone: "9700000009" }).returning({ id: users.id });
    const base = { flatId: "A", raisedBy: u.id, description: "x", category: "Plumbing", urgency: "MEDIUM" as const, createdAt: new Date("2026-10-10T10:00:00+05:30"), responseDueAt: new Date("2026-10-10T14:00:00+05:30") };
    await db.insert(complaints).values([
      { ...base, classifiedBy: "AI", aiConfidence: 90 }, // AI right
      { ...base, classifiedBy: "STAFF", aiConfidence: 40 }, // AI unsure, desk fixed it
      { ...base, classifiedBy: "STAFF" }, // AI was down; desk fixed the keyword rules
      { ...base, classifiedBy: "RULES" },
    ]);
    expect((await monthReport(db, "2026-10", "2026-11-20")).complaints.aiCorrected).toBe(50);
  });
});
