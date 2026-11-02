import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Q } from "@/db";
import { bankTxns, flatMembers, gatewayOrders, payerAccounts, users } from "@/db/schema";
import { matchContext } from "./bank-import";
import { todayIST } from "./dates";
import { BANKS, narrationFor, refFor, vpaFor, type Remitter } from "./narrations";

/**
 * A realistic HDFC-style statement built from today's dues, so the demo always has something to match:
 * clear payments that post themselves, and every kind that must wait for a person (amount-only, a typo in the
 * flat number, one signal, conflicting signals, a cheque), plus gateway payouts, bank interest, debits and two
 * lines already imported (to show they are skipped). Demo mode only.
 */
export async function sampleStatement(q: Q, today = todayIST()) {
  const { ctx, dues } = await matchContext(q, today);
  const [primaries, learned, payouts, seen, previous] = await Promise.all([
    q.select({ flatId: flatMembers.flatId, name: users.name }).from(flatMembers).innerJoin(users, eq(users.id, flatMembers.userId)).where(and(eq(flatMembers.isPrimary, true), eq(flatMembers.active, true))),
    q.select({ vpa: payerAccounts.vpa, flatId: payerAccounts.flatId }).from(payerAccounts),
    q
      .select({ id: gatewayOrders.settlementId, amount: sql<number>`sum(${gatewayOrders.amount})::int` })
      .from(gatewayOrders)
      .where(and(eq(gatewayOrders.status, "PAID"), isNotNull(gatewayOrders.settlementId)))
      .groupBy(gatewayOrders.settlementId),
    q.select({ narration: bankTxns.narration }).from(bankTxns).where(eq(bankTxns.status, "SETTLEMENT")),
    q.select({ date: bankTxns.txnDate, narration: bankTxns.narration, ref: bankTxns.refNo, amount: bankTxns.amount }).from(bankTxns).orderBy(desc(bankTxns.id)).limit(2),
  ]);
  const nameOf = new Map(primaries.map((p) => [p.flatId, p.name]));
  const vpaOf = new Map<string, string>();
  for (const l of learned) if (ctx.flatsForVpa(l.vpa).length === 1) vpaOf.set(l.flatId, l.vpa);

  let state = Number(today.replaceAll("-", ""));
  const rand = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
  const owing = [...dues].filter(([id, d]) => d.outstanding > 0 && nameOf.has(id) && !["T07-1203", "T12-0408", "T21-1601"].includes(id)).sort(() => rand() - 0.5);
  const used = new Set<string>();
  const take = (ok: (id: string, d: { outstanding: number; current: number }) => boolean = () => true) => {
    const hit = owing.find(([id, d]) => !used.has(id) && ok(id, d));
    if (hit) used.add(hit[0]);
    return hit;
  };

  type Line = { date: string; narration: string; ref: string; debit?: number; credit?: number };
  const lines: Line[] = [];
  let serial = 900;
  const pay = (r: Omit<Remitter, "ref" | "bank"> & { amount: number }) => {
    const bank = BANKS[serial % BANKS.length];
    const ref = refFor(r.method, bank, today, serial++);
    lines.push({ date: today, narration: narrationFor({ ...r, bank, ref }), ref, credit: r.amount });
  };
  const half = (paise: number) => Math.max(10_000, Math.round(paise / 2 / 10_000) * 10_000);

  // Post themselves: flat number in the note + the exact dues.
  for (let i = 0; i < 6; i++) {
    const f = take();
    if (f) pay({ method: "UPI", name: nameOf.get(f[0])!, vpa: vpaFor(nameOf.get(f[0])!, BANKS[i % BANKS.length], i + 3), flatId: f[0], withFlat: true, amount: f[1].outstanding });
  }
  // Post themselves: a UPI ID that has paid for the flat before + the exact dues, no flat number.
  for (let i = 0; i < 5; i++) {
    const f = take((id) => vpaOf.has(id));
    if (f) pay({ method: "UPI", name: nameOf.get(f[0])!, vpa: vpaOf.get(f[0])!, flatId: f[0], withFlat: false, amount: f[1].outstanding });
  }
  // Post themselves: part payment, flat number + the resident's own name.
  for (let i = 0; i < 2; i++) {
    const f = take((_, d) => d.outstanding >= 400_000);
    if (f) pay({ method: "IMPS", name: nameOf.get(f[0])!, flatId: f[0], withFlat: true, amount: half(f[1].outstanding) });
  }
  // Wait for a person: only the amount, which many flats owe.
  for (let i = 0; i < 2; i++) {
    const f = take((_, d) => d.outstanding === d.current && ctx.flatsOwing(d.current).length > 5);
    if (f) pay({ method: "NEFT", name: nameOf.get(f[0])!, flatId: f[0], withFlat: false, amount: f[1].outstanding });
  }
  // Wait: a typo in the flat number (two digits swapped, no such flat).
  const typo = take((id) => {
    const t = `${id.slice(0, 6)}${id[7]}${id[6]}`;
    return id[6] !== id[7] && !ctx.flatExists(t) && ctx.nearestFlat(t) === id;
  });
  if (typo) {
    const wrong = `${typo[0].slice(0, 6)}${typo[0][7]}${typo[0][6]}`;
    const bank = BANKS[1];
    const ref = refFor("NEFT", bank, today, serial++);
    lines.push({ date: today, narration: `NEFT CR-${bank.ifsc}-${nameOf.get(typo[0])!.toUpperCase()}-TOWNSHIP RESIDENTS FEDERATION-${ref} ${wrong.replace("-", " ")}`, ref, credit: typo[1].outstanding });
  }
  // Wait: flat number only, from someone else, an odd amount.
  const single = take();
  if (single) pay({ method: "UPI", name: "R K Traders", vpa: "rktraders@ybl", flatId: single[0], withFlat: true, amount: 300_000 });
  // Wait: the note names one flat, the UPI ID has paid for another.
  const a = take();
  const b = take((id) => vpaOf.has(id));
  if (a && b) {
    const bank = BANKS[0];
    const ref = refFor("UPI", bank, today, serial++);
    lines.push({ date: today, narration: `UPI-${nameOf.get(b[0])!.toUpperCase()}-${vpaOf.get(b[0])}-${bank.ifsc}-${ref}-${a[0].replace("-", " ")} maint`, ref, credit: a[1].outstanding });
  }
  // Wait: a cheque, surname only.
  const chq = take();
  if (chq) pay({ method: "CHEQUE", name: nameOf.get(chq[0])!, flatId: chq[0], withFlat: false, amount: chq[1].outstanding });

  // Gateway payouts that have reached the bank (one per day), bank interest, debits, and two old lines.
  const reconciled = seen.map((s) => s.narration).join(" ");
  const due = payouts.filter((p) => p.id && p.id.slice(5) <= today.replaceAll("-", "") && !reconciled.includes(p.id)).sort((x, y) => x.id!.localeCompare(y.id!));
  for (const p of due.slice(-4)) {
    const d = p.id!.slice(5);
    lines.push({ date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`, narration: `TESTPAY PAYMENTS PVT LTD SETTLEMENT ${p.id}`, ref: p.id!, credit: Number(p.amount) });
  }
  lines.push({ date: today, narration: "INT.PD 01-07-26 TO 30-09-26", ref: "", credit: 1_845_200 });
  lines.push({ date: today, narration: "NEFT DR-KONE ELEVATOR INDIA-AMC Q3 T14 LIFT REPAIR", ref: "000771", debit: 4_500_000 });
  lines.push({ date: today, narration: "CHGS SMS ALERT CHARGES QTR", ref: "", debit: 1_770 });
  for (const p of previous) lines.push({ date: p.date, narration: p.narration, ref: p.ref ?? "", credit: p.amount });

  lines.sort((x, y) => x.date.localeCompare(y.date));
  const ddmmyy = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;
  const money = (p?: number) => (p ? (p / 100).toFixed(2) : "");
  let balance = 4_52_18_340_00;
  const csv = [
    "HDFC BANK LTD,,,,,,",
    "Account: COMPANY A TOWNSHIP RESIDENTS FEDERATION - SAVINGS 50100XXXXXX123,,,,,,",
    `Statement from ${ddmmyy(lines[0]?.date ?? today)} to ${ddmmyy(today)},,,,,,`,
    ",,,,,,",
    "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance",
    ...lines.map((l) => {
      balance += (l.credit ?? 0) - (l.debit ?? 0);
      return [ddmmyy(l.date), `"${l.narration}"`, l.ref, ddmmyy(l.date), money(l.debit), money(l.credit), money(balance)].join(",");
    }),
    ",,,,,,",
    "** End of statement **,,,,,,",
  ].join("\n");
  return csv;
}
