import { addDays, daysBetween, TZ } from "./dates";

type AmenityRules = { slotMinutes: number; openMinute: number; closeMinute: number; maxPerWeek: number; advanceDays: number };
type BookingError = "slot" | "past" | "window" | "dues" | "limit";

export function slotsFor(a: AmenityRules) {
  const out: number[] = [];
  for (let m = a.openMinute; m + a.slotMinutes <= a.closeMinute; m += a.slotMinutes) out.push(m);
  return out;
}

/** Monday to Sunday around a date: the week the weekly limit counts in. */
export function weekOf(date: string): [string, string] {
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return [addDays(date, -dow), addDays(date, 6 - dow)];
}

/**
 * Booking rules: slots, rules and fees. Assumptions labelled in the TDD: a weekly limit per flat,
 * a booking window, and no bookings while dues are more than 60 days overdue.
 */
export function bookingError(a: AmenityRules, b: { date: string; startMinute: number; today: string; nowMinute: number; bookedThisWeek: number; daysOverdue: number }): BookingError | null {
  if (!slotsFor(a).includes(b.startMinute)) return "slot";
  if (b.date < b.today || (b.date === b.today && b.startMinute <= b.nowMinute)) return "past";
  if (daysBetween(b.today, b.date) > a.advanceDays) return "window";
  if (b.daysOverdue > 60) return "dues";
  if (b.bookedThisWeek >= a.maxPerWeek) return "limit";
  return null;
}

/** Cancel with a full refund up to 24 hours before the slot starts. */
export const canCancel = (date: string, startMinute: number, now = new Date()) =>
  new Date(`${date}T${String(Math.floor(startMinute / 60)).padStart(2, "0")}:${String(startMinute % 60).padStart(2, "0")}:00+05:30`).getTime() - now.getTime() >= 24 * 3_600_000;

export function minuteNowIST(now = new Date()) {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now).split(":").map(Number);
  return h * 60 + m;
}

/** 360 -> "6 am", 1110 -> "6:30 pm" */
export function fmtMinute(m: number) {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}
