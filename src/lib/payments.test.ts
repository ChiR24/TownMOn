import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import { flats, gatewayOrders, ledger, payments, users } from "@/db/schema";
import { testDb } from "@/db/testing";
import { flatPosition } from "./data";
import { inWords } from "./money";
import { captureOrder, receiptNo, signCallback } from "./payments";

let db: DB;
let userId: number;
beforeAll(async () => {
  db = await testDb();
  await db.insert(flats).values({ id: "T07-1203", tower: 7, floor: 12, unit: 3, areaSqft: 1150 });
  [{ id: userId }] = await db.insert(users).values({ name: "Neeraj Kulkarni", phone: "9800000001" }).returning({ id: users.id });
  await db.insert(ledger).values({ flatId: "T07-1203", kind: "MAINTENANCE", amount: 747_500, date: "2026-11-01", dueDate: "2026-11-15" });
});

describe("paying in the app", () => {
  it("posts a captured order once, however many times the gateway calls back", async () => {
    await db.insert(gatewayOrders).values({ id: "order_a", flatId: "T07-1203", amount: 747_500, createdBy: userId });
    const first = await captureOrder(db, "order_a", "pay_x", "UPI", "Neeraj Kulkarni", "2026-11-02");
    const again = await captureOrder(db, "order_a", "pay_x", "UPI", "Neeraj Kulkarni", "2026-11-02");
    expect(again).toBe(first);
    expect(await db.select().from(payments).where(eq(payments.flatId, "T07-1203"))).toHaveLength(1);
    expect((await flatPosition("T07-1203", db, "2026-11-02")).balance).toBe(0);
    const [o] = await db.select().from(gatewayOrders).where(eq(gatewayOrders.id, "order_a"));
    expect(o).toMatchObject({ status: "PAID", settlementId: "setl_20261103" });
  });

  it("signs callbacks so a browser can't forge a payment or change its method", () => {
    const sig = signCallback("order_a", "pay_x", "captured", "UPI");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(signCallback("order_a", "pay_x", "captured", "CARD")).not.toBe(sig);
    expect(signCallback("order_b", "pay_x", "captured", "UPI")).not.toBe(sig);
  });
});

describe("receipts", () => {
  it("numbers by financial year", () => {
    expect(receiptNo(123, "2026-11-02")).toBe("R/2026-27/000123");
    expect(receiptNo(9, "2027-03-31")).toBe("R/2026-27/000009");
    expect(receiptNo(9, "2027-04-01")).toBe("R/2027-28/000009");
  });

  it("writes amounts in words, Indian style", () => {
    expect(inWords(747_500)).toBe("Rupees Seven Thousand Four Hundred Seventy-Five only");
    expect(inWords(1_066_000)).toBe("Rupees Ten Thousand Six Hundred Sixty only");
    expect(inWords(12_34_56_789_50)).toBe("Rupees Twelve Crore Thirty-Four Lakh Fifty-Six Thousand Seven Hundred Eighty-Nine and Fifty Paise only");
  });
});
