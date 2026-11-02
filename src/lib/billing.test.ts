import { describe, expect, it } from "vitest";
import { ageing, billFor, daysOverdue, interestFor, position, settle, type Charge } from "./billing";

const maint = (amount: number, period: string): Charge => ({
  kind: "MAINTENANCE",
  amount,
  date: `${period}-01`,
  dueDate: `${period}-15`,
});

describe("bills for the reference flats", () => {
  it("bills area × ₹6.50", () => {
    expect(billFor("2026-11", 1150, [], []).maintenance).toBe(747_500); // T07-1203: ₹7,475
    expect(billFor("2026-11", 980, [], []).maintenance).toBe(637_000); // T12-0408: ₹6,370
    expect(billFor("2026-11", 1640, [], []).maintenance).toBe(1_066_000); // T21-1601: ₹10,660
  });

  it("T21-1601 paid ₹5,000 of ₹10,660 on 20 Oct: 18 days overdue on 2 Nov, interest on the rest", () => {
    const charges = [maint(1_066_000, "2026-10")];
    const credits = [{ amount: 500_000, date: "2026-10-20" }];
    const { items } = settle(charges, credits);
    expect(items[0].unpaid).toBe(566_000);
    expect(daysOverdue(items, "2026-11-02")).toBe(18);
    // 4 days on ₹10,660 (16–19 Oct) + 12 days on ₹5,660 (20–31 Oct) at 21% a year ≈ ₹63.61 -> ₹64
    expect(billFor("2026-11", 1640, charges, credits).interest).toBe(6_400);
  });
});

describe("interest", () => {
  it("is zero when paid on or before the due date", () => {
    expect(interestFor([maint(637_000, "2026-10")], [{ amount: 637_000, date: "2026-10-15" }], "2026-10-01", "2026-11-01")).toBe(0);
  });

  it("is never charged on interest, only on maintenance", () => {
    const interestOnly: Charge = { kind: "INTEREST", amount: 10_000, date: "2026-10-01", dueDate: "2026-10-15" };
    expect(interestFor([interestOnly], [], "2026-10-01", "2026-11-01")).toBe(0);
  });

  it("counts only days inside the window", () => {
    // ₹6,370 overdue all of November (30 days): 637000 × 30 × 0.21 / 365 = ₹109.95 -> ₹110
    expect(interestFor([maint(637_000, "2026-09")], [], "2026-11-01", "2026-12-01")).toBe(11_000);
  });
});

describe("settling payments", () => {
  it("clears the oldest dues first and keeps any extra as an advance", () => {
    const { items, advance } = settle([maint(100_000, "2026-09"), maint(100_000, "2026-10")], [{ amount: 250_000, date: "2026-10-05" }]);
    expect(items.map((i) => i.unpaid)).toEqual([0, 0]);
    expect(advance).toBe(50_000);
  });

  it("pays interest before the principal that falls due on the same day", () => {
    const interest: Charge = { kind: "INTEREST", amount: 5_000, date: "2026-11-01", dueDate: "2026-11-15" };
    const { items } = settle([maint(100_000, "2026-11"), interest], [{ amount: 5_000, date: "2026-11-03" }]);
    expect(items.find((i) => i.charge.kind === "INTEREST")!.unpaid).toBe(0);
    expect(items.find((i) => i.charge.kind === "MAINTENANCE")!.unpaid).toBe(100_000);
  });
});

describe("ageing and reversals", () => {
  it("buckets unpaid amounts by days past due", () => {
    const { items } = settle([maint(100, "2026-07"), maint(100, "2026-09"), maint(100, "2026-10"), maint(100, "2026-11")], []);
    // due 15 Jul (110 days), 15 Sep (48), 15 Oct (18), 15 Nov (not yet due) on 2 Nov
    expect(ageing(items, "2026-11-02")).toEqual([100, 100, 100, 0, 100]);
  });

  it("ignores a reversed payment but keeps the balance honest", () => {
    const rows = [
      { kind: "MAINTENANCE", amount: 637_000, date: "2026-10-01", dueDate: "2026-10-15", paymentId: null },
      { kind: "PAYMENT", amount: -637_000, date: "2026-10-05", dueDate: null, paymentId: 7 },
      { kind: "REVERSAL", amount: 637_000, date: "2026-10-09", dueDate: null, paymentId: 7 },
    ];
    const p = position(rows, "2026-11-02");
    expect(p.balance).toBe(637_000);
    expect(p.daysOverdue).toBe(18);
  });
});
