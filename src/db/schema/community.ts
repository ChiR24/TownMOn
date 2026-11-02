import { sql } from "drizzle-orm";
import { type AnyPgColumn, boolean, date, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { approvalMode, bookingStatus, bytea, classifiedBy, complaintStatus, id, ts, urgency, visitorStatus } from "./columns";
import { flats, users } from "./people";

// Day-to-day life: complaints and their photos, gate visitors and guest codes, amenity bookings, notices.

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
