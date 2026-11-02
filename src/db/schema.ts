import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Money is stored as integer paise everywhere. Dates without a time are 'YYYY-MM-DD' strings.
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const ts = () => timestamp({ withTimezone: true, mode: "date" });
const id = () => integer().primaryKey().generatedAlwaysAsIdentity();

export const role = pgEnum("role", ["RESIDENT", "GUARD", "HELPDESK", "ACCOUNTS", "COMMITTEE", "MANAGER", "TECHNICIAN"]);
export const relation = pgEnum("relation", ["OWNER", "TENANT", "FAMILY"]);
export const ledgerKind = pgEnum("ledger_kind", ["MAINTENANCE", "INTEREST", "AMENITY", "PAYMENT", "ADJUSTMENT", "REVERSAL"]);
export const payMethod = pgEnum("pay_method", ["UPI", "NEFT", "IMPS", "CHEQUE", "CARD", "NETBANKING", "CASH", "OTHER"]);
export const paySource = pgEnum("pay_source", ["GATEWAY", "BANK", "MANUAL"]);
export const orderStatus = pgEnum("order_status", ["CREATED", "PAID", "FAILED"]);
export const txnStatus = pgEnum("txn_status", ["AUTO_MATCHED", "NEEDS_REVIEW", "MATCHED", "IGNORED", "SETTLEMENT"]);
export const complaintStatus = pgEnum("complaint_status", ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
export const urgency = pgEnum("urgency", ["LOW", "MEDIUM", "HIGH", "EMERGENCY"]);
export const classifiedBy = pgEnum("classified_by", ["AI", "RULES", "STAFF"]);
export const visitorStatus = pgEnum("visitor_status", ["PENDING", "APPROVED", "DENIED", "INSIDE", "LEFT"]);
export const approvalMode = pgEnum("approval_mode", ["APP", "INTERCOM", "CODE"]);
export const bookingStatus = pgEnum("booking_status", ["CONFIRMED", "CANCELLED"]);

export const users = pgTable("users", {
  id: id(),
  name: text().notNull(),
  phone: text().notNull().unique(), // 10-digit Indian mobile
  role: role().notNull().default("RESIDENT"),
  team: text(), // technicians: the complaint category they handle
  lang: text().notNull().default("en"),
  privacyAcceptedAt: ts(),
  active: boolean().notNull().default(true),
  createdAt: ts().notNull().defaultNow(),
});

export const flats = pgTable("flats", {
  id: text().primaryKey(), // e.g. T07-1203
  tower: integer().notNull(),
  floor: integer().notNull(),
  unit: integer().notNull(),
  areaSqft: integer().notNull(),
});

export const flatMembers = pgTable(
  "flat_members",
  {
    id: id(),
    flatId: text().notNull().references(() => flats.id),
    userId: integer().notNull().references(() => users.id),
    relation: relation().notNull(),
    isPrimary: boolean().notNull().default(false),
    active: boolean().notNull().default(true),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [uniqueIndex("flat_members_uq").on(t.flatId, t.userId), index("flat_members_user_idx").on(t.userId)],
);

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

export type Suggestion = { flatId: string; score: number; reasons: string[] };

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

export const photos = pgTable("photos", {
  id: id(),
  mime: text().notNull(),
  bytes: bytea().notNull(),
  createdAt: ts().notNull().defaultNow(),
});

export const complaints = pgTable(
  "complaints",
  {
    id: id(),
    flatId: text().notNull().references(() => flats.id),
    raisedBy: integer().notNull().references(() => users.id),
    description: text().notNull(),
    title: text(), // short English summary for the help desk
    photoId: integer().references(() => photos.id),
    category: text().notNull(),
    urgency: urgency().notNull(),
    classifiedBy: classifiedBy().notNull(),
    aiConfidence: integer(), // 0-100
    needsTriage: boolean().notNull().default(false),
    safety: boolean().notNull().default(false),
    status: complaintStatus().notNull().default("OPEN"),
    assignedTo: integer().references(() => users.id),
    parentId: integer().references((): AnyPgColumn => complaints.id), // linked duplicate, never closed for it
    responseDueAt: ts().notNull(),
    firstResponseAt: ts(),
    resolvedAt: ts(),
    closedAt: ts(),
    rating: integer(),
    ratingComment: text(),
    reopenCount: integer().notNull().default(0),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index("complaints_flat_idx").on(t.flatId), index("complaints_status_idx").on(t.status)],
);

export const complaintEvents = pgTable(
  "complaint_events",
  {
    id: id(),
    complaintId: integer().notNull().references(() => complaints.id),
    actorId: integer().references(() => users.id), // null = system
    kind: text().notNull(),
    note: text(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index("complaint_events_complaint_idx").on(t.complaintId)],
);

export const guestCodes = pgTable(
  "guest_codes",
  {
    id: id(),
    flatId: text().notNull().references(() => flats.id),
    createdBy: integer().notNull().references(() => users.id),
    codeHash: text().notNull(), // keyed with APP_SECRET: the server's lookup
    // For checking codes on a gate tablet with no network: sha256(salt:code). Tablets get only these, never codes.
    salt: text().notNull().default(""),
    offlineHash: text().notNull().default(""),
    guestName: text().notNull(),
    validFrom: ts().notNull(),
    validTo: ts().notNull(),
    usedAt: ts(),
    revokedAt: ts(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index("guest_codes_hash_idx").on(t.codeHash)],
);

export const visitors = pgTable(
  "visitors",
  {
    id: id(),
    clientId: text().notNull().unique(), // generated on the gate tablet, makes offline sync idempotent
    flatId: text().notNull().references(() => flats.id),
    name: text().notNull(),
    phone: text(),
    purpose: text().notNull(), // GUEST | DELIVERY | CAB | SERVICE | OTHER
    gate: integer().notNull(),
    guardId: integer().notNull().references(() => users.id),
    photoId: integer().references(() => photos.id),
    status: visitorStatus().notNull().default("PENDING"),
    approvalMode: approvalMode(),
    decidedBy: integer().references(() => users.id),
    guestCodeId: integer().references(() => guestCodes.id),
    arrivedAt: ts().notNull(),
    decidedAt: ts(),
    enteredAt: ts(),
    leftAt: ts(),
    photoPurgedAt: ts(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index("visitors_flat_idx").on(t.flatId), index("visitors_arrived_idx").on(t.arrivedAt)],
);

export const amenities = pgTable("amenities", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  slotMinutes: integer().notNull(),
  openMinute: integer().notNull(),
  closeMinute: integer().notNull(),
  feePaise: integer().notNull(),
  maxPerWeek: integer().notNull(),
  advanceDays: integer().notNull(),
  rules: text().notNull(),
});

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    amenityId: integer().notNull().references(() => amenities.id),
    flatId: text().notNull().references(() => flats.id),
    bookedBy: integer().notNull().references(() => users.id),
    date: date().notNull(),
    startMinute: integer().notNull(),
    status: bookingStatus().notNull().default("CONFIRMED"),
    feePaise: integer().notNull(),
    createdAt: ts().notNull().defaultNow(),
    cancelledAt: ts(),
  },
  // The database, not app code, guarantees one confirmed booking per slot.
  (t) => [
    uniqueIndex("bookings_slot_uq").on(t.amenityId, t.date, t.startMinute).where(sql`status = 'CONFIRMED'`),
    index("bookings_flat_idx").on(t.flatId),
  ],
);

export const notices = pgTable("notices", {
  id: id(),
  title: text().notNull(),
  body: text().notNull(),
  tower: integer(), // null = whole township
  createdBy: integer().notNull().references(() => users.id),
  createdAt: ts().notNull().defaultNow(),
});

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: id(),
    phone: text().notNull(),
    codeHash: text().notNull(),
    attempts: integer().notNull().default(0),
    expiresAt: ts().notNull(),
    consumedAt: ts(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index("otp_phone_idx").on(t.phone)],
);

export const sessions = pgTable("sessions", {
  id: text().primaryKey(), // sha256 of the cookie token; the token itself is never stored
  userId: integer().notNull().references(() => users.id),
  expiresAt: ts().notNull(),
  createdAt: ts().notNull().defaultNow(),
});

// In-app notifications plus the mocked SMS / WhatsApp messages (channel tells which).
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: integer().notNull().references(() => users.id),
    channel: text().notNull().default("APP"),
    title: text().notNull(),
    body: text(),
    link: text(),
    readAt: ts(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorId: integer().references(() => users.id),
  action: text().notNull(),
  entity: text().notNull(),
  entityId: text(),
  detail: jsonb(),
  createdAt: ts().notNull().defaultNow(),
});
