import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import { auditLog, bills, flatMembers, flats, ledger, notifications } from "@/db/schema";
import { billFor, fromLedger, RATE_PAISE_PER_SQFT } from "./billing";
import { fmtDate, fmtMonth, todayIST } from "./dates";
import { rupees } from "./money";

/**
 * Raises the month's maintenance bill for every flat that doesn't have one yet. Safe to run twice (the database
 * allows one bill per flat per month). Only for a month that has started: interest for last month must be final.
 */
export async function generateBills(q: DB, period: string, by: number | null, today = todayIST()) {
  if (`${period}-01` > today) return { error: `Bills for ${fmtMonth(period)} can be raised from ${fmtDate(`${period}-01`)}.`, created: 0 };
  return q.transaction(async (tx) => {
    const done = new Set((await tx.select({ flatId: bills.flatId }).from(bills).where(eq(bills.period, period))).map((r) => r.flatId));
    const todo = (await tx.select({ id: flats.id, area: flats.areaSqft }).from(flats)).filter((f) => !done.has(f.id));
    if (!todo.length) return { created: 0 };

    const rows = await tx
      .select({ flatId: ledger.flatId, kind: ledger.kind, amount: ledger.amount, date: ledger.date, dueDate: ledger.dueDate, paymentId: ledger.paymentId })
      .from(ledger)
      .where(inArray(ledger.flatId, todo.map((f) => f.id)));
    const byFlat = new Map<string, typeof rows>();
    for (const r of rows) byFlat.set(r.flatId, [...(byFlat.get(r.flatId) ?? []), r]);

    const newBills = todo.map((f) => {
      const { charges, credits } = fromLedger(byFlat.get(f.id) ?? []);
      return { flatId: f.id, period, areaSqft: f.area, ratePaise: RATE_PAISE_PER_SQFT, ...billFor(period, f.area, charges, credits) };
    });
    for (let i = 0; i < newBills.length; i += 500) {
      const part = newBills.slice(i, i + 500);
      const ids = await tx.insert(bills).values(part).returning({ id: bills.id });
      await tx.insert(ledger).values(
        part.flatMap((b, j) => [
          { flatId: b.flatId, kind: "MAINTENANCE" as const, amount: b.maintenance, date: b.billDate, dueDate: b.dueDate, billId: ids[j].id, memo: `Maintenance for ${fmtMonth(period)}` },
          ...(b.interest ? [{ flatId: b.flatId, kind: "INTEREST" as const, amount: b.interest, date: b.billDate, dueDate: b.dueDate, billId: ids[j].id, memo: "Interest on overdue maintenance" }] : []),
        ]),
      );
    }
    // Tell each household: the bill is out, what it comes to, and when it's due.
    const people = await tx.select({ userId: flatMembers.userId, flatId: flatMembers.flatId }).from(flatMembers).where(and(eq(flatMembers.active, true), inArray(flatMembers.flatId, todo.map((f) => f.id))));
    const billOf = new Map(newBills.map((b) => [b.flatId, b]));
    for (let i = 0; i < people.length; i += 1000)
      await tx.insert(notifications).values(
        people.slice(i, i + 1000).map((p) => {
          const b = billOf.get(p.flatId)!;
          return { userId: p.userId, title: `${fmtMonth(period)} bill: ${rupees(b.maintenance + b.interest + Math.max(0, b.arrears))}`, body: `Due by ${fmtDate(b.dueDate)}. Pay in the app.`, link: "/bills" };
        }),
      );
    await tx.insert(auditLog).values({ actorId: by, action: "billing.run", entity: "bills", entityId: period, detail: { created: todo.length } });
    return { created: todo.length };
  });
}
