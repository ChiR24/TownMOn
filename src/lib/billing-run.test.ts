import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import { bills, flats, ledger } from "@/db/schema";
import { testDb } from "@/db/testing";
import { generateBills } from "./billing-run";
import { flatPosition } from "./data";

let db: DB;
beforeAll(async () => {
  db = await testDb();
  await db.insert(flats).values([
    { id: "T12-0408", tower: 12, floor: 4, unit: 8, areaSqft: 980 },
    { id: "T07-1203", tower: 7, floor: 12, unit: 3, areaSqft: 1150 },
  ]);
  // T12-0408 left October unpaid; T07-1203 paid on time.
  await db.insert(ledger).values([
    { flatId: "T12-0408", kind: "MAINTENANCE", amount: 637_000, date: "2026-10-01", dueDate: "2026-10-15" },
    { flatId: "T07-1203", kind: "MAINTENANCE", amount: 747_500, date: "2026-10-01", dueDate: "2026-10-15" },
    { flatId: "T07-1203", kind: "PAYMENT", amount: -747_500, date: "2026-10-05" },
  ]);
});

describe("the monthly bill run", () => {
  it("won't raise a month that hasn't started", async () => {
    expect((await generateBills(db, "2026-12", null, "2026-11-20")).created).toBe(0);
  });

  it("bills every flat once, with interest only where something was overdue", async () => {
    expect(await generateBills(db, "2026-11", null, "2026-11-01")).toEqual({ created: 2 });
    expect(await generateBills(db, "2026-11", null, "2026-11-01")).toEqual({ created: 0 });
    const [late] = await db.select().from(bills).where(eq(bills.flatId, "T12-0408"));
    const [onTime] = await db.select().from(bills).where(eq(bills.flatId, "T07-1203"));
    // 16 days (16-31 Oct) on ₹6,370 at 21% a year = ₹58.64 -> ₹59
    expect(late).toMatchObject({ maintenance: 637_000, interest: 5_900, arrears: 637_000, dueDate: "2026-11-15" });
    expect(onTime).toMatchObject({ maintenance: 747_500, interest: 0, arrears: 0 });
    expect((await flatPosition("T12-0408", db, "2026-11-02")).balance).toBe(637_000 * 2 + 5_900);
  });
});
