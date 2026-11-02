import { and, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { DB, Q, Tx } from "@/db";
import { auditLog, bankImports, bankTxns, bills, flatMembers, flats, gatewayOrders, ledger, payerAccounts, payments, users } from "@/db/schema";
import { matchCredit, oneSlip, readNarration, type MatchContext } from "./bank";
import { readStatement } from "./bank-csv";
import { sha256 } from "./crypto";
import { flatPositions } from "./data";
import { todayIST } from "./dates";
import { postPayment } from "./payments";

/**
 * The same bank line in a later statement has the same fingerprint, so it is never posted twice. The reference and
 * the running balance keep two genuine look-alikes apart (two cash deposits of the same amount on the same day).
 */
export const fingerprint = (date: string, narration: string, amount: number, ref = "", balance: number | null = null) =>
  sha256(`${date}|${narration}|${amount}|${ref}|${balance ?? ""}`);

/** Everything the matcher needs, loaded once per import: flats, dues, learned UPI IDs, names, gateway payouts. */
export async function matchContext(q: Q, today = todayIST()) {
  const [flatRows, positions, currentBills, vpas, members, payouts] = await Promise.all([
    q.select({ id: flats.id }).from(flats),
    flatPositions(q, { today }),
    q.select({ flatId: bills.flatId, amount: sql<number>`(${bills.maintenance} + ${bills.interest})::int` }).from(bills).where(eq(bills.period, today.slice(0, 7))),
    q.select({ vpa: payerAccounts.vpa, flatId: payerAccounts.flatId }).from(payerAccounts),
    q.select({ flatId: flatMembers.flatId, name: users.name }).from(flatMembers).innerJoin(users, eq(users.id, flatMembers.userId)).where(eq(flatMembers.active, true)),
    q
      .select({ id: gatewayOrders.settlementId, amount: sql<number>`sum(${gatewayOrders.amount})::int`, count: sql<number>`count(*)::int` })
      .from(gatewayOrders)
      .where(and(eq(gatewayOrders.status, "PAID"), isNotNull(gatewayOrders.settlementId)))
      .groupBy(gatewayOrders.settlementId),
  ]);
  const current = new Map(currentBills.map((b) => [b.flatId, Number(b.amount)]));
  const dues = new Map(flatRows.map(({ id }) => [id, { outstanding: Math.max(0, positions.get(id)?.balance ?? 0), current: current.get(id) ?? 0 }]));
  // Which flats owe a given amount, as their whole dues or as this month's bill.
  const owing = Map.groupBy(
    [...dues].flatMap(([id, d]) => [...new Set([d.outstanding, d.current])].filter((a) => a > 0).map((amount) => ({ id, amount }))),
    (o) => o.amount,
  );
  const byVpa = Map.groupBy(vpas, (r) => r.vpa);
  const names = Map.groupBy(members, (r) => r.flatId);
  const byTower = Map.groupBy(flatRows, (r) => r.id.slice(0, 3));
  const ids = new Set(flatRows.map((f) => f.id));
  const payout = new Map(payouts.map((p) => [p.id!, { amount: Number(p.amount), count: Number(p.count) }]));

  const ctx: MatchContext = {
    flatExists: (id) => ids.has(id),
    nearestFlat: (code) => {
      const near = (byTower.get(code.slice(0, 3)) ?? []).filter(({ id }) => oneSlip(id.slice(4), code.slice(4)));
      return near.length === 1 ? near[0].id : undefined;
    },
    flatsForVpa: (v) => (byVpa.get(v) ?? []).map((r) => r.flatId),
    due: (id) => dues.get(id),
    names: (id) => (names.get(id) ?? []).map((r) => r.name),
    flatsOwing: (a) => (owing.get(a) ?? []).map((o) => o.id),
    settlement: (id) => payout.get(id),
  };
  return { ctx, dues };
}

const learnVpa = (tx: Tx, vpa: string, flatId: string) => tx.insert(payerAccounts).values({ vpa, flatId }).onConflictDoNothing();
const audit = (tx: Tx, actorId: number, action: string, entityId: number, detail: object) =>
  tx.insert(auditLog).values({ actorId, action, entity: "bank_txn", entityId: String(entityId), detail });

/**
 * Reads a statement and records every credit. Clear matches are posted to the flat at once; the rest wait
 * in the accounts queue and are never posted to a flat automatically. Debits are not our business.
 */
export async function importStatement(q: DB, { fileName, text, uploadedBy }: { fileName: string; text: string; uploadedBy: number }) {
  const { rows, problems } = readStatement(text);
  const credits = rows.filter((r) => r.credit > 0);
  if (!credits.length) return { error: problems[0] ?? "No incoming payments found in this file." };
  const { ctx, dues } = await matchContext(q);

  return q.transaction(async (tx) => {
    const [imp] = await tx.insert(bankImports).values({ fileName, uploadedBy, rows: rows.length, credits: credits.length }).returning({ id: bankImports.id });
    const prints = credits.map((r) => fingerprint(r.date, r.narration, r.credit, r.ref, r.balance));
    const seen = new Set((await tx.select({ f: bankTxns.fingerprint }).from(bankTxns).where(inArray(bankTxns.fingerprint, prints))).map((r) => r.f));
    let autoMatched = 0;
    let needsReview = 0;
    let duplicates = 0;

    for (const [i, r] of credits.entries()) {
      if (seen.has(prints[i])) {
        duplicates++;
        continue;
      }
      seen.add(prints[i]);
      const n = readNarration(r.narration, r.ref);
      const m = matchCredit(r.credit, n, ctx);
      const [txn] = await tx
        .insert(bankTxns)
        .values({
          importId: imp.id,
          fingerprint: prints[i],
          txnDate: r.date,
          narration: r.narration,
          refNo: r.ref || null,
          amount: r.credit,
          method: n.method,
          payerVpa: n.vpa ?? null,
          payerName: n.payerName ?? null,
          utr: n.utr ?? null,
          status: m.status,
          confidence: m.confidence,
          reasons: m.reasons,
          suggestions: m.suggestions,
          flatId: m.flatId ?? null,
          resolvedAt: m.status === "NEEDS_REVIEW" ? null : new Date(),
        })
        .returning({ id: bankTxns.id });

      if (m.status === "AUTO_MATCHED" && m.flatId) {
        const paymentId = await postPayment(tx, { flatId: m.flatId, amount: r.credit, method: n.method, source: "BANK", paidOn: r.date, reference: n.utr ?? (r.ref || null), payerVpa: n.vpa, payerName: n.payerName, bankTxnId: txn.id });
        await tx.update(bankTxns).set({ paymentId }).where(eq(bankTxns.id, txn.id));
        if (n.vpa) await learnVpa(tx, n.vpa, m.flatId);
        const d = dues.get(m.flatId);
        if (d) d.outstanding = Math.max(0, d.outstanding - r.credit);
        autoMatched++;
      } else if (m.status === "NEEDS_REVIEW") needsReview++;
    }
    await tx.update(bankImports).set({ autoMatched, needsReview, duplicates }).where(eq(bankImports.id, imp.id));
    return { id: imp.id, autoMatched, needsReview, duplicates, problems };
  });
}

/** A person decides which flat a queued credit belongs to. The UPI ID is remembered, so next month it matches itself. */
export async function postTxnToFlat(q: DB, txnId: number, flatId: string, by: number) {
  return q.transaction(async (tx) => {
    const [t] = await tx.select().from(bankTxns).where(eq(bankTxns.id, txnId)).for("update");
    if (!t || t.status !== "NEEDS_REVIEW") return { error: "Someone already handled this entry." };
    const [f] = await tx.select({ id: flats.id }).from(flats).where(eq(flats.id, flatId));
    if (!f) return { error: `There is no flat ${flatId}.` };
    const paymentId = await postPayment(tx, { flatId, amount: t.amount, method: t.method ?? "OTHER", source: "BANK", paidOn: t.txnDate, reference: t.utr ?? t.refNo, payerVpa: t.payerVpa, payerName: t.payerName, bankTxnId: t.id, createdBy: by });
    await tx.update(bankTxns).set({ status: "MATCHED", flatId, paymentId, resolvedBy: by, resolvedAt: new Date() }).where(eq(bankTxns.id, txnId));
    if (t.payerVpa) await learnVpa(tx, t.payerVpa, flatId);
    await audit(tx, by, "bank.match", txnId, { flatId, amount: t.amount });
    return { paymentId };
  });
}

/** Not a maintenance payment (bank interest, a refund, a vendor return): recorded, never posted to a flat. */
export async function ignoreTxn(q: DB, txnId: number, by: number, reason: string) {
  return q.transaction(async (tx) => {
    const [t] = await tx.select({ status: bankTxns.status, reasons: bankTxns.reasons }).from(bankTxns).where(eq(bankTxns.id, txnId)).for("update");
    if (!t || t.status !== "NEEDS_REVIEW") return { error: "Someone already handled this entry." };
    await tx.update(bankTxns).set({ status: "IGNORED", reasons: [...t.reasons, `Not a resident payment: ${reason}`], resolvedBy: by, resolvedAt: new Date() }).where(eq(bankTxns.id, txnId));
    await audit(tx, by, "bank.ignore", txnId, { reason });
    return {};
  });
}

/**
 * Undoes a wrong posting without deleting anything: the payment is marked reversed, a reversal line goes on the
 * flat's ledger, and a bank entry behind it goes back to the queue. The monthly report stays reproducible.
 */
export async function reversePayment(q: DB, paymentId: number, by: number, reason: string) {
  return q.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!p || p.reversedAt) return { error: "This payment was already reversed." };
    if (p.source === "GATEWAY") return { error: "Online payments are refunded through the gateway, not reversed here." };
    await tx.update(payments).set({ reversedAt: new Date(), reversalReason: reason }).where(eq(payments.id, paymentId));
    await tx.insert(ledger).values({ flatId: p.flatId, kind: "REVERSAL", amount: p.amount, date: todayIST(), paymentId, memo: `Payment reversed: ${reason}`, createdBy: by });
    // A wrong posting may have taught the matcher this UPI ID for this flat. Forget it, unless the same UPI ID has
    // other payments for the flat that still stand.
    if (p.payerVpa) {
      const [other] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(and(eq(payments.payerVpa, p.payerVpa), eq(payments.flatId, p.flatId), isNull(payments.reversedAt), ne(payments.id, p.id)))
        .limit(1);
      if (!other) await tx.delete(payerAccounts).where(and(eq(payerAccounts.vpa, p.payerVpa), eq(payerAccounts.flatId, p.flatId)));
    }
    if (p.bankTxnId) {
      await tx.update(bankTxns).set({ status: "NEEDS_REVIEW", flatId: null, paymentId: null, resolvedBy: null, resolvedAt: null }).where(eq(bankTxns.id, p.bankTxnId));
      await audit(tx, by, "bank.reverse", p.bankTxnId, { paymentId, flatId: p.flatId, reason });
    }
    return { flatId: p.flatId };
  });
}
