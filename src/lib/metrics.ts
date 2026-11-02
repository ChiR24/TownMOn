import { and, count, gte, isNull, lt, sum } from "drizzle-orm";
import type { Q } from "@/db";
import { bankTxns, complaints, ledger, payments } from "@/db/schema";
import { AGEING_BUCKETS, type Settled } from "./billing";
import { addDays, shiftPeriod, todayIST } from "./dates";
import { flatPositions } from "./data";
import { METHOD_LABEL } from "./payments";

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const pct = (part: number, whole: number) => (whole ? Math.round((1000 * part) / whole) / 10 : null);

/** Share of a month's bills paid in full by their due date. Null until the due date has passed. */
export function onTimeRate(positions: Map<string, { items: Settled[] }>, period: string, today: string) {
  const due = `${period}-15`;
  if (due >= today) return null;
  let billed = 0;
  let onTime = 0;
  for (const { items } of positions.values()) {
    const bill = items.find((i) => i.charge.kind === "MAINTENANCE" && i.charge.date === `${period}-01`);
    if (!bill) continue;
    billed++;
    const paidByDue = bill.paid.filter((p) => p.on <= due).reduce((a, p) => a + p.amount, 0);
    if (paidByDue >= bill.charge.amount) onTime++;
  }
  return pct(onTime, billed);
}

/**
 * Everything the committee sees for one month, straight from the ledger and the complaint records.
 * The money identity (opening + billed + reversed - collected = closing) is computed from independent sums.
 */
export async function monthReport(q: Q, period: string, today = todayIST()) {
  const start = `${period}-01`;
  const next = `${shiftPeriod(period, 1)}-01`;
  const asOf = next <= today ? addDays(next, -1) : today;
  const inMonth = and(gte(ledger.date, start), lt(ledger.date, next));

  const [[opening], [closing], movements, byMethod, positions, cRows, txns] = await Promise.all([
    q.select({ v: sum(ledger.amount) }).from(ledger).where(lt(ledger.date, start)),
    q.select({ v: sum(ledger.amount) }).from(ledger).where(lt(ledger.date, next)),
    q.select({ kind: ledger.kind, v: sum(ledger.amount), n: count() }).from(ledger).where(inMonth).groupBy(ledger.kind),
    q
      .select({ method: payments.method, source: payments.source, v: sum(payments.amount), n: count() })
      .from(payments)
      .where(and(gte(payments.paidOn, start), lt(payments.paidOn, next), isNull(payments.reversedAt)))
      .groupBy(payments.method, payments.source),
    flatPositions(q, { today: asOf, until: next }),
    q
      .select({
        category: complaints.category,
        createdAt: complaints.createdAt,
        firstResponseAt: complaints.firstResponseAt,
        responseDueAt: complaints.responseDueAt,
        resolvedAt: complaints.resolvedAt,
        status: complaints.status,
        reopenCount: complaints.reopenCount,
        rating: complaints.rating,
        classifiedBy: complaints.classifiedBy,
        parentId: complaints.parentId,
      })
      .from(complaints)
      .where(and(gte(complaints.createdAt, new Date(`${start}T00:00:00+05:30`)), lt(complaints.createdAt, new Date(`${next}T00:00:00+05:30`)))),
    // By the bank's date, not the import date: October's statement is usually imported in November.
    q.select({ status: bankTxns.status, n: count() }).from(bankTxns).where(and(gte(bankTxns.txnDate, start), lt(bankTxns.txnDate, next))).groupBy(bankTxns.status),
  ]);

  // ---- money ----
  const kind = (k: string) => Number(movements.find((m) => m.kind === k)?.v ?? 0);
  const billed = { maintenance: kind("MAINTENANCE"), interest: kind("INTEREST"), amenity: kind("AMENITY"), adjustments: Math.max(0, kind("ADJUSTMENT")) };
  const billedTotal = billed.maintenance + billed.interest + billed.amenity + billed.adjustments;
  const collected = -(kind("PAYMENT") + Math.min(0, kind("ADJUSTMENT")));
  const reversed = kind("REVERSAL");
  const open = Number(opening?.v ?? 0);
  const close = Number(closing?.v ?? 0);

  // ---- dues ----
  const ageing = AGEING_BUCKETS.map((label) => ({ label, amount: 0, flats: 0 }));
  let flatsOverdue = 0;
  for (const p of positions.values()) {
    p.ageing.forEach((v: number, i: number) => {
      ageing[i].amount += v;
      if (v > 0) ageing[i].flats++;
    });
    if (p.daysOverdue > 0) flatsOverdue++;
  }
  const defaulters = [...positions.entries()]
    .filter(([, p]) => p.daysOverdue > 60)
    .map(([flatId, p]) => ({ flatId, balance: p.balance, days: p.daysOverdue }))
    .sort((a, b) => b.days - a.days || b.balance - a.balance);

  // ---- complaints (one per problem: linked duplicates are counted once) ----
  const roots = cRows.filter((c) => c.parentId == null);
  const answered = roots.filter((c) => c.firstResponseAt);
  const finished = roots.filter((c) => c.resolvedAt || c.status === "CLOSED");
  const ai = cRows.filter((c) => c.classifiedBy !== "RULES");
  const rated = roots.filter((c) => c.rating);
  const byCategory = [...new Set(roots.map((c) => c.category))]
    .map((category) => {
      const rows = roots.filter((c) => c.category === category);
      return {
        category,
        count: rows.length,
        responseMin: median(rows.filter((c) => c.firstResponseAt).map((c) => (c.firstResponseAt!.getTime() - c.createdAt.getTime()) / 60_000)),
        resolutionH: median(rows.filter((c) => c.resolvedAt).map((c) => (c.resolvedAt!.getTime() - c.createdAt.getTime()) / 3_600_000)),
        reopened: rows.filter((c) => c.reopenCount > 0).length,
      };
    })
    .sort((a, b) => b.count - a.count);

  const t = (s: string) => txns.find((x) => x.status === s)?.n ?? 0;
  const residentCredits = t("AUTO_MATCHED") + t("MATCHED") + t("NEEDS_REVIEW");

  return {
    period,
    asOf,
    money: { opening: open, billed, billedTotal, collected, reversed, closing: close, difference: open + billedTotal + reversed - collected - close },
    collectionRate: pct(collected, billedTotal),
    byMethod: byMethod.map((m) => ({ method: `${METHOD_LABEL[m.method]}${m.source === "GATEWAY" ? " (in the app)" : ""}`, amount: Number(m.v ?? 0), count: m.n })).sort((a, b) => b.amount - a.amount),
    onTime: onTimeRate(positions, period, today),
    ageing,
    flatsOverdue,
    defaulters,
    complaints: {
      received: roots.length,
      reports: cRows.length,
      responseMedianMin: median(answered.map((c) => (c.firstResponseAt!.getTime() - c.createdAt.getTime()) / 60_000)),
      withinTarget: pct(answered.filter((c) => c.firstResponseAt! <= c.responseDueAt).length, answered.length),
      resolutionMedianH: median(finished.filter((c) => c.resolvedAt).map((c) => (c.resolvedAt!.getTime() - c.createdAt.getTime()) / 3_600_000)),
      reopenRate: pct(finished.filter((c) => c.reopenCount > 0).length, finished.length),
      rating: rated.length ? Math.round((10 * rated.reduce((a, c) => a + c.rating!, 0)) / rated.length) / 10 : null,
      aiCorrected: pct(ai.filter((c) => c.classifiedBy === "STAFF").length, ai.length),
      byCategory,
    },
    matching: { credits: residentCredits, auto: t("AUTO_MATCHED"), manual: t("MATCHED"), waiting: t("NEEDS_REVIEW"), autoRate: pct(t("AUTO_MATCHED"), residentCredits), payouts: t("SETTLEMENT") },
  };
}
export type MonthReport = Awaited<ReturnType<typeof monthReport>>;

/** On-time rate for the last few months whose due date has passed: the committee's headline trend. */
export async function onTimeTrend(q: Q, months = 4, today = todayIST()) {
  const positions = await flatPositions(q, { today });
  const periods = Array.from({ length: months + 1 }, (_, i) => shiftPeriod(today.slice(0, 7), i - months));
  return periods.map((period) => ({ period, rate: onTimeRate(positions, period, today) })).filter((p) => p.rate != null) as { period: string; rate: number }[];
}
