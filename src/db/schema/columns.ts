import { customType, integer, pgEnum, timestamp } from "drizzle-orm/pg-core";

// Shared column helpers and every enum. Money is stored as integer paise everywhere; dates without a time are 'YYYY-MM-DD' strings.

export const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const ts = () => timestamp({ withTimezone: true, mode: "date" });

export const id = () => integer().primaryKey().generatedAlwaysAsIdentity();

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
