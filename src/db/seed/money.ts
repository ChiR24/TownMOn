// Step 2: four months of bills and payments run through the real billing engine, gateway orders, bank imports.
import { sql } from "drizzle-orm";
import { billFor, type Charge, type Credit } from "../../lib/billing";
import { sha256 } from "../../lib/crypto";
import { addDays, fmtMonth, shiftPeriod } from "../../lib/dates";
import { sum } from "../../lib/money";
import { BANKS, narrationFor, refFor, vpaFor, type Bank } from "../../lib/narrations";
import { db } from "../index";
import * as s from "../schema";
import { DEMO, type Method, type Plan } from "./cast";
import { ago, at, between, chance, chunked, later, pad, pick, PERIOD, PERIODS, rand, today } from "./kit";
import type { Township } from "./people";

type PayRow = typeof s.payments.$inferInsert & { _flat: string; _bank: Bank; _withFlat: boolean; _method: Method };

export async function seedMoney({ flats, uid, primaryOf, staff }: Township) {
  const billRows: (typeof s.bills.$inferInsert)[] = [];
  const payRows: PayRow[] = [];
  const arrearsRows: (typeof s.ledger.$inferInsert)[] = [];
  const learnedVpa: { vpa: string; flatId: string }[] = [];
  let paySerial = 1;

  for (const f of flats) {
    const flatId = f.id!;
    const demo = DEMO[flatId];
    const name = primaryOf.get(flatId)!.name;
    const bank = pick(BANKS);
    const r = rand();
    const profile = r < 0.7 ? "ontime" : r < 0.86 ? "late" : r < 0.91 ? "partial" : r < 0.96 ? "skipper" : "defaulter";
    const m = rand();
    const method: Method = demo?.method ?? (m < 0.5 ? "UPI" : m < 0.72 ? "GATEWAY" : m < 0.84 ? "NEFT" : m < 0.92 ? "CHEQUE" : "IMPS");
    const vpa = demo?.vpa ?? vpaFor(name, bank, paySerial);
    if (method === "UPI" && (demo || chance(0.75))) learnedVpa.push({ vpa, flatId });
    const skipIdx = between(0, 3);
    const stopIdx = between(0, 2);
    const plan = (i: number): Plan => {
      if (demo) return demo.plan(i);
      if (profile === "ontime") return { day: between(1, 12) };
      if (profile === "late") return { day: between(17, 28) };
      if (profile === "partial") return { day: between(3, 20), part: 0.5 };
      if (profile === "skipper") return i === skipIdx ? null : { day: between(2, 14) };
      return i < stopIdx ? { day: between(10, 28) } : null;
    };

    const charges: Charge[] = [];
    const credits: Credit[] = [];
    if (profile === "defaulter" && !demo && chance(0.6)) {
      const months = between(2, 4);
      const amount = f.areaSqft! * 650 * months;
      const date = addDays(`${PERIODS[0]}-01`, -1);
      charges.push({ kind: "MAINTENANCE", amount, date, dueDate: `${shiftPeriod(PERIODS[0], -months)}-15` });
      arrearsRows.push({ flatId, kind: "MAINTENANCE", amount, date, dueDate: `${shiftPeriod(PERIODS[0], -months)}-15`, memo: `Arrears brought forward (${months} months)` });
    }
    PERIODS.forEach((period, i) => {
      const bill = billFor(period, f.areaSqft!, charges, credits);
      billRows.push({ flatId, period, ...bill, areaSqft: f.areaSqft!, ratePaise: 650 });
      charges.push({ kind: "MAINTENANCE", amount: bill.maintenance, date: bill.billDate, dueDate: bill.dueDate });
      if (bill.interest) charges.push({ kind: "INTEREST", amount: bill.interest, date: bill.billDate, dueDate: bill.dueDate });
      const p = plan(i);
      if (!p) return;
      const paidOn = `${period}-${pad(p.day)}`;
      if (paidOn > today) return;
      const owed = sum(charges.map((c) => c.amount)) - sum(credits.map((c) => c.amount));
      if (owed <= 0) return;
      const amount = p.amount ?? (p.part ? Math.max(100_00, Math.round((owed * p.part) / 100_00) * 100_00) : owed);
      credits.push({ amount, date: paidOn });
      const how = p.method ?? method;
      const gateway = how === "GATEWAY";
      const ref = refFor(gateway ? "UPI" : how, bank, paidOn, paySerial++);
      payRows.push({
        flatId,
        amount,
        method: gateway ? pick(["UPI", "UPI", "UPI", "CARD", "NETBANKING"] as const) : how,
        source: gateway ? "GATEWAY" : "BANK",
        paidOn,
        reference: gateway ? `pay_${sha256(`${flatId}${paidOn}`).slice(0, 14)}` : ref,
        gatewayPaymentId: gateway ? `pay_${sha256(`${flatId}${paidOn}`).slice(0, 14)}` : null,
        payerVpa: how === "UPI" ? vpa : null,
        payerName: name,
        createdAt: at(paidOn, `${pad(between(7, 21))}:${pad(between(0, 59))}`),
        _flat: flatId,
        _bank: bank,
        _withFlat: how === "UPI" ? chance(0.6) : how === "IMPS" ? chance(0.5) : how === "NEFT" ? chance(0.3) : false,
        _method: how,
      });
    });
  }

  const billIds = await chunked(billRows, (part) => db.insert(s.bills).values(part).returning({ id: s.bills.id }));
  const payIds = await chunked(
    payRows.map((p) => Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith("_"))) as typeof s.payments.$inferInsert),
    (part) => db.insert(s.payments).values(part).returning({ id: s.payments.id }),
  );

  const ledgerRows: (typeof s.ledger.$inferInsert)[] = [...arrearsRows];
  billRows.forEach((b, i) => {
    ledgerRows.push({ flatId: b.flatId, kind: "MAINTENANCE", amount: b.maintenance, date: b.billDate, dueDate: b.dueDate, billId: billIds[i].id, memo: `Maintenance for ${fmtMonth(b.period)}` });
    if (b.interest) ledgerRows.push({ flatId: b.flatId, kind: "INTEREST", amount: b.interest!, date: b.billDate, dueDate: b.dueDate, billId: billIds[i].id, memo: "Interest on overdue maintenance" });
  });
  payRows.forEach((p, i) => ledgerRows.push({ flatId: p.flatId, kind: "PAYMENT", amount: -p.amount, date: p.paidOn, paymentId: payIds[i].id, memo: p.source === "GATEWAY" ? "Paid in the app" : `${p.method} received` }));
  await chunked(ledgerRows, (part) => db.insert(s.ledger).values(part).returning({ id: s.ledger.id }));

  // Online payments: gateway orders, settled to the bank the next day.
  const orders = payRows.flatMap((p, i) =>
    p.source === "GATEWAY"
      ? [{ id: `order_${sha256(`o${payIds[i].id}`).slice(0, 14)}`, flatId: p.flatId, amount: p.amount, status: "PAID" as const, createdBy: uid.get(primaryOf.get(p.flatId)!.phone)!, paymentId: payIds[i].id, settlementId: `setl_${addDays(p.paidOn, 1).replaceAll("-", "")}`, createdAt: p.createdAt, paidAt: p.createdAt }]
      : [],
  );
  await chunked(orders, (part) => db.insert(s.gatewayOrders).values(part).returning({ id: s.gatewayOrders.id }));

  // Bank imports for last month and this month so far.
  for (const period of [PERIODS[2], PERIODS[3]]) {
    const bankPays = payRows.map((p, i) => ({ p, id: payIds[i].id })).filter(({ p }) => p.source === "BANK" && p.paidOn.startsWith(period));
    if (!bankPays.length) continue;
    const importedAt = period === PERIOD ? ago(180) : new Date(Math.min(at(`${PERIOD}-01`, "10:30").getTime(), ago(120).getTime()));
    const known = new Set(learnedVpa.map((l) => l.vpa));
    const txns = bankPays.map(({ p, id }) => {
      const narration = narrationFor({ method: p._method as "UPI", name: p.payerName!, vpa: p.payerVpa ?? undefined, bank: p._bank, flatId: p.flatId, withFlat: p._withFlat, ref: p.reference! });
      const auto = p._withFlat || (p.payerVpa != null && known.has(p.payerVpa));
      return {
        importId: 0,
        fingerprint: sha256(`${p.paidOn}|${narration}|${p.amount}`),
        txnDate: p.paidOn,
        narration,
        refNo: p.reference,
        amount: p.amount,
        method: p.method,
        payerVpa: p.payerVpa,
        payerName: p.payerName,
        utr: p.reference,
        status: auto ? ("AUTO_MATCHED" as const) : ("MATCHED" as const),
        confidence: auto ? between(85, 100) : between(20, 60),
        reasons: auto ? [p._withFlat ? `Payment note says ${p.flatId}` : `UPI ID ${p.payerVpa} has paid for ${p.flatId} before`, "Amount equals the full dues"] : ["Matched by accounts"],
        suggestions: [],
        flatId: p.flatId,
        paymentId: id,
        resolvedBy: auto ? null : staff.ACCOUNTS,
        resolvedAt: auto ? importedAt : later(importedAt, between(4, 90)),
        createdAt: importedAt,
      };
    });
    const [imp] = await db
      .insert(s.bankImports)
      .values({
        fileName: `HDFC-statement-${period}.csv`,
        uploadedBy: staff.ACCOUNTS,
        rows: txns.length,
        credits: txns.length,
        autoMatched: txns.filter((t) => t.status === "AUTO_MATCHED").length,
        needsReview: txns.filter((t) => t.status === "MATCHED").length,
        createdAt: importedAt,
      })
      .returning({ id: s.bankImports.id });
    await chunked(txns.map((t) => ({ ...t, importId: imp.id })), (part) => db.insert(s.bankTxns).values(part).returning({ id: s.bankTxns.id }));
  }
  await db.execute(sql`update payments set bank_txn_id = b.id from bank_txns b where b.payment_id = payments.id`);
  await chunked(learnedVpa, (part) => db.insert(s.payerAccounts).values(part).returning({ id: s.payerAccounts.id }));
}
