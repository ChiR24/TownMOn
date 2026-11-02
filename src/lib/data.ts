import { and, eq, inArray, lt } from "drizzle-orm";
import { db, type Q } from "@/db";
import { flatMembers, ledger, users } from "@/db/schema";
import { position } from "./billing";
import { todayIST } from "./dates";

const ledgerCols = { kind: ledger.kind, amount: ledger.amount, date: ledger.date, dueDate: ledger.dueDate, paymentId: ledger.paymentId };

/** Balance, days overdue, ageing and the settled charges for one flat, straight from its ledger. */
export async function flatPosition(flatId: string, q: Q = db, today = todayIST()) {
  const rows = await q.select(ledgerCols).from(ledger).where(eq(ledger.flatId, flatId)).orderBy(ledger.id);
  return position(rows, today);
}

/** Positions for many flats in one query (dashboard, matcher, reports). `until` cuts the ledger off at a date. */
export async function flatPositions(q: Q = db, { flatIds, today = todayIST(), until }: { flatIds?: string[]; today?: string; until?: string } = {}) {
  const rows = await q
    .select({ flatId: ledger.flatId, ...ledgerCols })
    .from(ledger)
    .where(and(flatIds ? inArray(ledger.flatId, flatIds) : undefined, until ? lt(ledger.date, until) : undefined))
    .orderBy(ledger.id);
  return new Map([...Map.groupBy(rows, (r) => r.flatId)].map(([flatId, rs]) => [flatId, position(rs, today)]));
}

/** Everyone who should hear about something happening at a flat. */
export async function flatPeople(flatId: string, q: Q = db) {
  return q
    .select({ id: users.id, name: users.name })
    .from(flatMembers)
    .innerJoin(users, eq(users.id, flatMembers.userId))
    .where(and(eq(flatMembers.flatId, flatId), eq(flatMembers.active, true), eq(users.active, true)));
}

/** True if the user is an active member of the flat. Used before every flat-scoped read or write. */
export async function isMember(userId: number, flatId: string, q: Q = db) {
  const [m] = await q
    .select({ id: flatMembers.id })
    .from(flatMembers)
    .where(and(eq(flatMembers.userId, userId), eq(flatMembers.flatId, flatId), eq(flatMembers.active, true)));
  return !!m;
}
