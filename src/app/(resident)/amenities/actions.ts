"use server";

import { and, between, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { amenities, bookings, ledger } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { bookingError, canCancel, fmtMinute, minuteNowIST, weekOf } from "@/lib/amenities";
import { fmtDate, shiftPeriod, todayIST } from "@/lib/dates";
import { flatPosition } from "@/lib/data";

const back = (slug: string, date: string, q: string) => redirect(`/amenities?a=${slug}&d=${date}&${q}`);

export async function book(amenityId: number, date: string, startMinute: number) {
  const { user, flat } = await requireResident();
  const [a] = await db.select().from(amenities).where(eq(amenities.id, amenityId));
  if (!a || !/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/amenities");
  const today = todayIST();
  const [from, to] = weekOf(date);
  const [[{ n }], pos] = await Promise.all([
    db.select({ n: count() }).from(bookings).where(and(eq(bookings.flatId, flat.flatId), eq(bookings.amenityId, a.id), eq(bookings.status, "CONFIRMED"), between(bookings.date, from, to))),
    flatPosition(flat.flatId),
  ]);
  const err = bookingError(a, { date, startMinute, today, nowMinute: minuteNowIST(), bookedThisWeek: n, daysOverdue: pos.daysOverdue });
  if (err) back(a.slug, date, `err=${err}&n=${err === "limit" ? a.maxPerWeek : a.advanceDays}`);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(bookings).values({ amenityId: a.id, flatId: flat.flatId, bookedBy: user.id, date, startMinute, feePaise: a.feePaise });
      if (a.feePaise)
        await tx.insert(ledger).values({ flatId: flat.flatId, kind: "AMENITY", amount: a.feePaise, date: today, dueDate: `${shiftPeriod(today.slice(0, 7), 1)}-15`, memo: `${a.name}, ${fmtDate(date)} ${fmtMinute(startMinute)}`, createdBy: user.id });
    });
  } catch (e) {
    // The unique index on (amenity, date, slot) for confirmed bookings: someone else got there first.
    const code = (e as { cause?: { code?: string }; code?: string }).cause?.code ?? (e as { code?: string }).code;
    if (code === "23505") back(a.slug, date, "err=taken");
    throw e;
  }
  revalidatePath("/amenities");
  back(a.slug, date, "done=1");
}

export async function cancelBooking(id: number) {
  const { user, flat } = await requireResident();
  const [b] = await db.select({ b: bookings, name: amenities.name, slug: amenities.slug }).from(bookings).innerJoin(amenities, eq(amenities.id, bookings.amenityId)).where(and(eq(bookings.id, id), eq(bookings.flatId, flat.flatId), eq(bookings.status, "CONFIRMED")));
  if (!b) redirect("/amenities");
  if (!canCancel(b.b.date, b.b.startMinute)) back(b.slug, b.b.date, "err=cancelLate");
  await db.transaction(async (tx) => {
    await tx.update(bookings).set({ status: "CANCELLED", cancelledAt: new Date() }).where(eq(bookings.id, id));
    if (b.b.feePaise) await tx.insert(ledger).values({ flatId: flat.flatId, kind: "ADJUSTMENT", amount: -b.b.feePaise, date: todayIST(), memo: `Refund: ${b.name} booking cancelled`, createdBy: user.id });
  });
  revalidatePath("/amenities");
  back(b.slug, b.b.date, "cancelled=1");
}
