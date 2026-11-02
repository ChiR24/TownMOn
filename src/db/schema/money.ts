import { date, index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, ledgerKind, orderStatus, payMethod, paySource, ts, txnStatus } from "./columns";
import { flats, users } from "./people";

// Billing and payments: bills, the per-flat ledger, gateway orders, bank statement imports and matching.

export const bills = pgTable(
  "bills",
  {
    id: id(),
    flatId: text().notNull().references(() => flats.id),
    period: text().notNull(), // YYYY-MM
    billDate: date().notNull(),
    dueDate: date().notNull(),
    areaSqft: integer().notNull(),
    ratePaise: integer().notNull(),
    maintenance: integer().notNull(),
    interest: integer().notNull().default(0),
    arrears: integer().notNull().default(0), // balance brought forward when the bill was made
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [uniqueIndex("bills_flat_period_uq").on(t.flatId, t.period)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    flatId: text().notNull().references(() => flats.id),
    amount: integer().notNull(),
    method: payMethod().notNull(),
    source: paySource().notNull(),
    paidOn: date().notNull(),
    reference: text(), // UTR / RRN / cheque number / gateway payment id
    payerVpa: text(),
    payerName: text(),
    gatewayPaymentId: text().unique(),
    bankTxnId: integer(),
    createdBy: integer().references(() => users.id),
    reversedAt: ts(),
    reversalReason: text(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index("payments_flat_idx").on(t.flatId)],
);

// Every rupee that moves for a flat. Balance = sum(amount): charges are positive, credits negative.
export const ledger = pgTable(
  "ledger",
  {
    id: id(),
    flatId: text().notNull().references(() => flats.id),
    kind: ledgerKind().notNull(),
    amount: integer().notNull(),
    date: date().notNull(), // business date: bill date for charges, paid date for payments
    dueDate: date(), // charges only
    billId: integer().references(() => bills.id),
    paymentId: integer().references(() => payments.id),
    memo: text(),
    createdBy: integer().references(() => users.id),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index("ledger_flat_idx").on(t.flatId)],
);

export const gatewayOrders = pgTable("gateway_orders", {
  id: text().primaryKey(), // order_xxx
  flatId: text().notNull().references(() => flats.id),
  amount: integer().notNull(),
  status: orderStatus().notNull().default("CREATED"),
  createdBy: integer().notNull().references(() => users.id),
  paymentId: integer().references(() => payments.id),
  settlementId: text(),
  createdAt: ts().notNull().defaultNow(),
  paidAt: ts(),
});

export const bankImports = pgTable("bank_imports", {
  id: id(),
  fileName: text().notNull(),
  uploadedBy: integer().notNull().references(() => users.id),
  rows: integer().notNull().default(0),
  credits: integer().notNull().default(0),
  autoMatched: integer().notNull().default(0),
  needsReview: integer().notNull().default(0),
  duplicates: integer().notNull().default(0),
  createdAt: ts().notNull().defaultNow(),
});

type Suggestion = { flatId: string; score: number; reasons: string[] };

export const bankTxns = pgTable(
  "bank_txns",
  {
    id: id(),
    importId: integer().notNull().references(() => bankImports.id),
    fingerprint: text().notNull().unique(), // same row in a later statement is skipped
    txnDate: date().notNull(),
    narration: text().notNull(),
    refNo: text(),
    amount: integer().notNull(),
    method: payMethod(),
    payerVpa: text(),
    payerName: text(),
    utr: text(),
    status: txnStatus().notNull(),
    confidence: integer().notNull().default(0),
    reasons: jsonb().$type<string[]>().notNull(),
    suggestions: jsonb().$type<Suggestion[]>().notNull(),
    flatId: text().references(() => flats.id),
    paymentId: integer().references(() => payments.id),
    resolvedBy: integer().references(() => users.id),
    resolvedAt: ts(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index("bank_txns_status_idx").on(t.status)],
);

// UPI IDs learned from confirmed payments, so next month's payment from the same UPI ID matches itself.
export const payerAccounts = pgTable(
  "payer_accounts",
  {
    id: id(),
    vpa: text().notNull(),
    flatId: text().notNull().references(() => flats.id),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payer_accounts_uq").on(t.vpa, t.flatId)],
);
