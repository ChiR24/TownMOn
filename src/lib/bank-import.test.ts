import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import { bankTxns, flatMembers, flats, gatewayOrders, ledger, payerAccounts, payments, users } from "@/db/schema";
import { testDb } from "@/db/testing";
import { importStatement, postTxnToFlat, reversePayment } from "./bank-import";
import { flatPosition } from "./data";
import { todayIST } from "./dates";

const today = todayIST();
const ddmmyy = `${today.slice(8)}/${today.slice(5, 7)}/${today.slice(2, 4)}`;
const csv = (...lines: string[]) => ["Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance", ...lines.map((l) => `${ddmmyy},${l}`)].join("\n");

let db: DB;
let accounts: number;
beforeAll(async () => {
  db = await testDb();
  await db.insert(flats).values([
    { id: "T07-1203", tower: 7, floor: 12, unit: 3, areaSqft: 1150 },
    { id: "T07-1204", tower: 7, floor: 12, unit: 4, areaSqft: 1380 },
    { id: "T12-0408", tower: 12, floor: 4, unit: 8, areaSqft: 980 },
  ]);
  const [n, s, a] = await db
    .insert(users)
    .values([
      { name: "Neeraj Kulkarni", phone: "9800000001" },
      { name: "Swati Joshi", phone: "9800000002" },
      { name: "Sunita Deshmukh", phone: "9800000011", role: "ACCOUNTS" },
    ])
    .returning({ id: users.id });
  accounts = a.id;
  await db.insert(flatMembers).values([
    { flatId: "T07-1203", userId: n.id, relation: "OWNER", isPrimary: true },
    { flatId: "T12-0408", userId: s.id, relation: "TENANT", isPrimary: true },
  ]);
  const due = `${today.slice(0, 7)}-15`;
  await db.insert(ledger).values([
    { flatId: "T07-1203", kind: "MAINTENANCE", amount: 747_500, date: `${today.slice(0, 7)}-01`, dueDate: due },
    { flatId: "T07-1204", kind: "MAINTENANCE", amount: 897_000, date: `${today.slice(0, 7)}-01`, dueDate: due },
    { flatId: "T12-0408", kind: "MAINTENANCE", amount: 637_000, date: `${today.slice(0, 7)}-01`, dueDate: due },
  ]);
  await db.insert(payerAccounts).values({ vpa: "neeraj.kulkarni@okhdfcbank", flatId: "T07-1203" });
  await db.insert(gatewayOrders).values({ id: "order_1", flatId: "T07-1204", amount: 897_000, status: "PAID", createdBy: n.id, settlementId: "setl_20261102" });
});

describe("importing a bank statement", () => {
  it("posts clear matches, queues the rest, reconciles payouts and never posts a line twice", async () => {
    const text = csv(
      `"UPI-NEERAJ KULKARNI-neeraj.kulkarni@okhdfcbank-HDFC0001234-612345678901-maintenance",612345678901,${ddmmyy},,7475.00,100000.00`,
      `"NEFT CR-ICIC0000123-SWATI JOSHI-TOWNSHIP RESIDENTS FEDERATION-ICICN52026110212345678",,${ddmmyy},,6370.00,106370.00`,
      `"TESTPAY PAYMENTS SETTLEMENT setl_20261102",,${ddmmyy},,8970.00,115340.00`,
      `"PAYMENT TO LIFT VENDOR",000045,${ddmmyy},25000.00,,90340.00`,
    );
    const r = await importStatement(db, { fileName: "nov.csv", text, uploadedBy: accounts });
    expect(r).toMatchObject({ autoMatched: 1, needsReview: 1, duplicates: 0 });
    // Swati: name + amount, but no flat number or known UPI ID -> a person decides.
    const txns = await db.select().from(bankTxns).orderBy(bankTxns.id);
    expect(txns.map((t) => t.status)).toEqual(["AUTO_MATCHED", "NEEDS_REVIEW", "SETTLEMENT"]);
    expect((await flatPosition("T07-1203", db)).balance).toBe(0);

    const again = await importStatement(db, { fileName: "nov-again.csv", text, uploadedBy: accounts });
    expect(again).toMatchObject({ autoMatched: 0, needsReview: 0, duplicates: 3 });
    expect(await db.select().from(payments)).toHaveLength(1);
  });

  it("posts a reviewed entry and remembers the UPI ID for next time", async () => {
    const text = csv(`"UPI-SWATI JOSHI-swati.joshi@okicici-ICIC0000123-612345678909-thanks",612345678909,${ddmmyy},,500.00,1000.00`);
    await importStatement(db, { fileName: "a.csv", text, uploadedBy: accounts });
    const [queued] = await db.select().from(bankTxns).where(eq(bankTxns.payerVpa, "swati.joshi@okicici"));
    expect(queued.status).toBe("NEEDS_REVIEW");
    await postTxnToFlat(db, queued.id, "T12-0408", accounts);
    expect(await postTxnToFlat(db, queued.id, "T12-0408", accounts)).toEqual({ error: "Someone already handled this entry." });

    // Next month the same UPI ID pays the rest: known UPI ID + amount equals dues -> posts itself.
    const rest = (await flatPosition("T12-0408", db)).balance;
    const next = csv(`"UPI-SWATI JOSHI-swati.joshi@okicici-ICIC0000123-612345678910-maint",612345678910,${ddmmyy},,${(rest / 100).toFixed(2)},2000.00`);
    expect(await importStatement(db, { fileName: "b.csv", text: next, uploadedBy: accounts })).toMatchObject({ autoMatched: 1 });
  });

  it("reverses a wrong posting without deleting it and sends the entry back to the queue", async () => {
    const [p] = await db.select().from(payments).where(eq(payments.flatId, "T07-1203"));
    await reversePayment(db, p.id, accounts, "Belongs to T07-1204");
    expect((await flatPosition("T07-1203", db)).balance).toBe(747_500);
    const [t] = await db.select().from(bankTxns).where(eq(bankTxns.id, p.bankTxnId!));
    expect(t.status).toBe("NEEDS_REVIEW");
    expect(await reversePayment(db, p.id, accounts, "again")).toEqual({ error: "This payment was already reversed." });
    // The UPI ID taught by that wrong posting is forgotten, so it can't pull next month's payment to the same flat.
    expect(await db.select().from(payerAccounts).where(eq(payerAccounts.flatId, "T07-1203"))).toHaveLength(0);
  });

  it("keeps two identical cash deposits on the same day apart (their running balances differ)", async () => {
    const text = csv(`"BY CASH DEPOSIT",,${ddmmyy},,7475.00,200000.00`, `"BY CASH DEPOSIT",,${ddmmyy},,7475.00,207475.00`);
    expect(await importStatement(db, { fileName: "cash.csv", text, uploadedBy: accounts })).toMatchObject({ duplicates: 0 });
    expect(await db.select().from(bankTxns).where(eq(bankTxns.narration, "BY CASH DEPOSIT"))).toHaveLength(2);
  });
});
