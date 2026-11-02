import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, relation, role, ts } from "./columns";

// People and access: residents, staff, flats and who belongs to them, sign-in, notifications, the audit log.

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
