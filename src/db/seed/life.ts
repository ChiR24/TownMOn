// Step 4: a month of gate visitors and guest codes, amenity bookings (fees on the ledger), notices.
import { keyedHash } from "../../lib/crypto";
import { addDays, fmtDate, fmtMonth, todayIST } from "../../lib/dates";
import { offlineHashOf } from "../../lib/gate";
import { db } from "../index";
import * as s from "../schema";
import { DEMO, person } from "./cast";
import { ago, at, between, chance, chunked, nextDueDate, now, PERIOD, pick, placeholderPhoto, rand, today } from "./kit";
import type { Township } from "./people";

const DELIVERY = ["Zomato delivery", "Swiggy delivery", "Amazon delivery", "Blinkit delivery", "Flipkart delivery", "BigBasket delivery"];
const SERVICE = ["Urban Company (AC service)", "Plumber (private)", "Internet technician", "Maid (new)"];

export async function seedLife({ flats, uid, primaryOf, staff }: Township) {
  const neeraj = uid.get("9800000001")!;
  // Guest codes for Neeraj: one already used by the cook, one live for his niece (315760, in deployment.md).
  const [usedCode] = await db
    .insert(s.guestCodes)
    .values([
      { flatId: "T07-1203", createdBy: neeraj, codeHash: keyedHash("guest:482913"), salt: "s1", offlineHash: offlineHashOf("s1", "482913"), guestName: "Asha (cook)", validFrom: ago(60 * 6), validTo: ago(60 * 2), usedAt: ago(60 * 5) },
      { flatId: "T07-1203", createdBy: neeraj, codeHash: keyedHash("guest:315760"), salt: "s2", offlineHash: offlineHashOf("s2", "315760"), guestName: "Kavya (niece)", validFrom: ago(60), validTo: new Date(now.getTime() + 2 * 86_400_000) },
    ])
    .returning({ id: s.guestCodes.id });
  const oldPhotos = await db
    .insert(s.photos)
    .values([0, 1, 2].map((i) => ({ mime: "image/png", bytes: placeholderPhoto(), createdAt: ago(60 * 24 * (92 + i * 3)) })))
    .returning({ id: s.photos.id });

  const visitorRows: (typeof s.visitors.$inferInsert)[] = [];
  let v = 1;
  const visitor = (row: Omit<typeof s.visitors.$inferInsert, "clientId" | "gate" | "guardId"> & { gate?: number }) =>
    visitorRows.push({ gate: 1, guardId: staff.GUARDS[0], clientId: `seed-${v++}`, ...row });
  visitor({ flatId: "T07-1203", name: "Imran (Swiggy)", purpose: "DELIVERY", status: "PENDING", arrivedAt: ago(2) });
  visitor({ flatId: "T07-1203", name: "Asha (cook)", purpose: "SERVICE", status: "LEFT", approvalMode: "CODE", guestCodeId: usedCode.id, arrivedAt: ago(300), decidedAt: ago(300), enteredAt: ago(300), leftAt: ago(170) });
  visitor({ flatId: "T12-0408", name: "Ritu Sharma", purpose: "GUEST", status: "INSIDE", approvalMode: "APP", decidedBy: uid.get("9800000002"), arrivedAt: ago(52), decidedAt: ago(51), enteredAt: ago(50), gate: 2, phone: "9812345678" });
  // Three visitors from over 90 days ago, with photos the daily job must delete (DPDP).
  oldPhotos.forEach((p, i) => visitor({ flatId: pick(flats).id!, name: pick(DELIVERY), purpose: "DELIVERY", status: "LEFT", approvalMode: "APP", photoId: p.id, arrivedAt: ago(60 * 24 * (92 + i * 3)), decidedAt: ago(60 * 24 * (92 + i * 3) - 1), enteredAt: ago(60 * 24 * (92 + i * 3) - 2), leftAt: ago(60 * 24 * (92 + i * 3) - 9) }));
  for (let i = 0; i < 320; i++) {
    const minutes = between(30, 60 * 24 * 30);
    const r = rand();
    const purpose = r < 0.42 ? "DELIVERY" : r < 0.85 ? "GUEST" : r < 0.92 ? "CAB" : "SERVICE";
    const denied = chance(0.07);
    const mode = purpose === "GUEST" && chance(0.35) ? "CODE" : chance(0.7) ? "APP" : "INTERCOM";
    visitor({
      flatId: pick(flats).id!,
      name: purpose === "DELIVERY" ? pick(DELIVERY) : purpose === "CAB" ? pick(["Ola cab", "Uber cab", "Rapido"]) : purpose === "SERVICE" ? pick(SERVICE) : person(),
      purpose,
      gate: between(1, 4),
      status: denied ? "DENIED" : "LEFT",
      approvalMode: denied ? "APP" : mode,
      arrivedAt: ago(minutes),
      decidedAt: ago(minutes - 1),
      enteredAt: denied ? null : ago(minutes - 2),
      leftAt: denied ? null : ago(Math.max(1, minutes - between(5, purpose === "GUEST" ? 240 : 20))),
    });
  }
  await chunked(visitorRows, (part) => db.insert(s.visitors).values(part).returning({ id: s.visitors.id }));

  // Amenities and bookings: fees go on the flat's ledger.
  const amenityIds = await db
    .insert(s.amenities)
    .values([
      { slug: "clubhouse-hall", name: "Clubhouse hall", slotMinutes: 240, openMinute: 600, closeMinute: 1320, feePaise: 200_000, maxPerWeek: 1, advanceDays: 30, rules: "For private functions of up to 80 guests. Music off by 10 pm. Leave the hall as you found it; it is checked before the next booking." },
      { slug: "tennis-court", name: "Tennis court", slotMinutes: 60, openMinute: 360, closeMinute: 1320, feePaise: 10_000, maxPerWeek: 3, advanceDays: 7, rules: "Non-marking shoes only. Floodlights after 6:30 pm are included in the fee." },
      { slug: "badminton-court", name: "Badminton court (indoor)", slotMinutes: 60, openMinute: 360, closeMinute: 1320, feePaise: 5_000, maxPerWeek: 3, advanceDays: 7, rules: "Bring your own shuttles. Children under 12 play with an adult." },
    ])
    .returning({ id: s.amenities.id, slotMinutes: s.amenities.slotMinutes, openMinute: s.amenities.openMinute, closeMinute: s.amenities.closeMinute, feePaise: s.amenities.feePaise });
  const taken = new Set<string>();
  const bookingRows: (typeof s.bookings.$inferInsert)[] = [];
  for (let i = 0; i < 70; i++) {
    const a = i < 4 ? amenityIds[0] : pick(amenityIds.slice(1));
    const date = addDays(today, i < 4 ? between(3, 28) : between(0, 6));
    const slots = (a.closeMinute - a.openMinute) / a.slotMinutes;
    const startMinute = a.openMinute + between(0, slots - 1) * a.slotMinutes;
    const key = `${a.id}|${date}|${startMinute}`;
    const flat = pick(flats).id!;
    if (taken.has(key) || DEMO[flat]) continue;
    taken.add(key);
    bookingRows.push({ amenityId: a.id, flatId: flat, bookedBy: uid.get(primaryOf.get(flat)!.phone)!, date, startMinute, feePaise: a.feePaise, createdAt: ago(between(60, 60 * 24 * 5)) });
  }
  await db.insert(s.bookings).values(bookingRows);
  await chunked(
    bookingRows.map((b) => ({ flatId: b.flatId, kind: "AMENITY" as const, amount: b.feePaise, date: todayIST(b.createdAt as Date), dueDate: nextDueDate(todayIST(b.createdAt as Date)), memo: `Amenity booking on ${fmtDate(b.date)}` })),
    (part) => db.insert(s.ledger).values(part).returning({ id: s.ledger.id }),
  );

  // Notices and a couple of notifications.
  await db.insert(s.notices).values([
    { title: `Maintenance bills for ${fmtMonth(PERIOD)} are out`, body: "Pay by the 15th to avoid interest. Pay in the app by UPI, card or net banking and the receipt is instant. Bank transfers are matched to your flat automatically when you write your flat number (e.g. T07 1203) in the payment note.", createdBy: staff.COMMITTEE, createdAt: at(`${PERIOD}-01`, "09:00") < now ? at(`${PERIOD}-01`, "09:00") : ago(60) },
    { title: "Lift A in T14 under repair", body: "The lift vendor is on site and expects it back in service by evening. Lift B is working. Thank you for reporting it so quickly.", tower: 14, createdBy: staff.HELPDESK, createdAt: ago(140) },
    { title: "Water shutdown in T12 on Thursday, 10 am to 2 pm", body: "Overhead tank cleaning. Please store water the night before.", tower: 12, createdBy: staff.HELPDESK, createdAt: ago(60 * 26) },
    { title: `Annual General Meeting on ${fmtDate(addDays(today, 20))}`, body: "11 am at the clubhouse. Agenda: audited accounts, next year's maintenance rate, CCTV upgrade. Owners or their nominees may attend.", createdBy: staff.COMMITTEE, createdAt: ago(60 * 24 * 3) },
  ]);
  await db.insert(s.notifications).values([
    { userId: neeraj, title: "Imran (Swiggy) is at Gate 1", body: "Approve or deny in the app.", link: "/visitors", createdAt: ago(2) },
    { userId: neeraj, title: `Receipt for ${fmtMonth(PERIOD)} maintenance`, body: "₹7,475 received. Thank you.", link: "/bills", createdAt: at(`${PERIOD}-01`, "09:30") < now ? at(`${PERIOD}-01`, "09:30") : ago(30) },
  ]);
}
