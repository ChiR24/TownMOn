import { dayNum, shiftPeriod } from "./dates";
import { sum } from "./money";

// ₹6.50 per sq ft per month. Bye-law terms below are labelled assumptions in the TDD.
export const RATE_PAISE_PER_SQFT = 650;
export const INTEREST_BPS = 2100; // 21% a year, simple, on overdue maintenance only
export const DUE_DAY = 15; // bills dated the 1st, due on the 15th

export type ChargeKind = "MAINTENANCE" | "INTEREST" | "AMENITY" | "ADJUSTMENT";
export type Charge = { kind: ChargeKind; amount: number; date: string; dueDate: string };
export type Credit = { amount: number; date: string };
export type Settled = { charge: Charge; paid: { amount: number; on: string }[]; unpaid: number };

type LedgerRow = { kind: string; amount: number; date: string; dueDate: string | null; paymentId: number | null };

/** Split a flat's ledger into charges and credits. Reversed payments drop out entirely. */
export function fromLedger(rows: LedgerRow[]) {
  const reversed = new Set(rows.filter((r) => r.kind === "REVERSAL").map((r) => r.paymentId));
  const charges: Charge[] = [];
  const credits: Credit[] = [];
  for (const r of rows) {
    if (r.kind === "REVERSAL" || (r.kind === "PAYMENT" && reversed.has(r.paymentId))) continue;
    if (r.amount < 0) credits.push({ amount: -r.amount, date: r.date });
    else charges.push({ kind: r.kind as ChargeKind, amount: r.amount, date: r.date, dueDate: r.dueDate ?? r.date });
  }
  return { charges, credits };
}

const KIND_ORDER: Record<ChargeKind, number> = { INTEREST: 0, ADJUSTMENT: 1, AMENITY: 2, MAINTENANCE: 3 };

/**
 * Apply credits to charges, oldest due date first (interest before principal on the same due date).
 * Whatever is left over is an advance that the next bill will absorb.
 */
export function settle(charges: Charge[], credits: Credit[]): { items: Settled[]; advance: number } {
  const items: Settled[] = charges
    .filter((c) => c.amount > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
    .map((charge) => ({ charge, paid: [], unpaid: charge.amount }));
  let i = 0;
  let advance = 0;
  for (const credit of [...credits].sort((a, b) => a.date.localeCompare(b.date))) {
    let left = credit.amount;
    while (left > 0 && i < items.length) {
      const take = Math.min(left, items[i].unpaid);
      items[i].unpaid -= take;
      items[i].paid.push({ amount: take, on: credit.date });
      left -= take;
      if (items[i].unpaid === 0) i++;
    }
    advance += left;
  }
  return { items, advance };
}

/**
 * Simple interest on overdue maintenance for the days in [from, to). Interest starts the day after
 * the due date and stops the day a payment clears that principal. Never charged on interest itself.
 */
export function interestFor(charges: Charge[], credits: Credit[], from: string, to: string, bps = INTEREST_BPS) {
  const end = dayNum(to);
  let paiseDays = 0;
  for (const { charge, paid } of settle(charges, credits).items) {
    if (charge.kind !== "MAINTENANCE") continue;
    let cursor = Math.max(dayNum(charge.dueDate) + 1, dayNum(from));
    if (cursor >= end) continue;
    let outstanding = charge.amount;
    for (const p of paid) {
      const d = dayNum(p.on);
      if (d >= end) break;
      if (d > cursor) {
        paiseDays += outstanding * (d - cursor);
        cursor = d;
      }
      outstanding -= p.amount;
    }
    if (cursor < end) paiseDays += outstanding * (end - cursor);
  }
  return Math.round((paiseDays * bps) / 10_000 / 365 / 100) * 100; // rounded to whole rupees
}

/** What a flat owes for a month: maintenance by area, plus interest for last month's overdue days. */
export function billFor(period: string, areaSqft: number, charges: Charge[], credits: Credit[], ratePaise = RATE_PAISE_PER_SQFT) {
  const billDate = `${period}-01`;
  const prior = charges.filter((c) => c.date < billDate);
  const paid = credits.filter((c) => c.date < billDate);
  return {
    billDate,
    dueDate: `${period}-${String(DUE_DAY).padStart(2, "0")}`,
    maintenance: areaSqft * ratePaise,
    interest: interestFor(prior, paid, `${shiftPeriod(period, -1)}-01`, billDate),
    arrears: sum(prior.map((c) => c.amount)) - sum(paid.map((c) => c.amount)),
  };
}

/** Days since the oldest unpaid charge fell due (0 if nothing is overdue). */
export function daysOverdue(items: Settled[], today: string) {
  const oldest = items.find((i) => i.unpaid > 0 && i.charge.dueDate < today);
  return oldest ? dayNum(today) - dayNum(oldest.charge.dueDate) : 0;
}

export const AGEING_BUCKETS = ["Not yet due", "1–30 days", "31–60 days", "61–90 days", "Over 90 days"] as const;

/** Unpaid paise per ageing bucket, by days past each charge's due date. */
export function ageing(items: Settled[], today: string) {
  const out = [0, 0, 0, 0, 0];
  for (const i of items) {
    if (i.unpaid <= 0) continue;
    const late = dayNum(today) - dayNum(i.charge.dueDate);
    out[late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4] += i.unpaid;
  }
  return out;
}

/** One-call summary of a flat's position, used by the resident home, the matcher and the dashboard. */
export function position(rows: LedgerRow[], today: string) {
  const { charges, credits } = fromLedger(rows);
  const { items, advance } = settle(charges, credits);
  const balance = sum(rows.map((r) => r.amount));
  return { items, advance, balance, daysOverdue: daysOverdue(items, today), ageing: ageing(items, today) };
}
