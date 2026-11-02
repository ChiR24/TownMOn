import { and, asc, eq, gte } from "drizzle-orm";
import { CalendarDays, CircleCheck, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { Card, cx, EmptyState, Notice, PageTitle, Section } from "@/components/ui";
import { db } from "@/db";
import { amenities, bookings } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { canCancel, fmtMinute, minuteNowIST, slotsFor } from "@/lib/amenities";
import { addDays, fmtDate, fmtDay, todayIST } from "@/lib/dates";
import { getLang } from "@/lib/lang";
import { translator, type Key } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import { book, cancelBooking } from "./actions";

export const metadata: Metadata = { title: "Book an amenity" };

type Search = { a?: string; d?: string; slot?: string; err?: string; n?: string; done?: string; cancelled?: string };

export default async function AmenitiesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { flat } = await requireResident();
  const lang = await getLang();
  const t = translator(lang);
  const sp = await searchParams;
  const list = await db.select().from(amenities).orderBy(asc(amenities.id));
  const a = list.find((x) => x.slug === sp.a) ?? list[0];
  const today = todayIST();
  const days = Array.from({ length: Math.min(a.advanceDays, 14) + 1 }, (_, i) => addDays(today, i));
  const day = sp.d && days.includes(sp.d) ? sp.d : today;
  const [taken, mine] = await Promise.all([
    db.select({ startMinute: bookings.startMinute, flatId: bookings.flatId }).from(bookings).where(and(eq(bookings.amenityId, a.id), eq(bookings.date, day), eq(bookings.status, "CONFIRMED"))),
    db
      .select({ id: bookings.id, date: bookings.date, startMinute: bookings.startMinute, name: amenities.name, slot: amenities.slotMinutes })
      .from(bookings)
      .innerJoin(amenities, eq(amenities.id, bookings.amenityId))
      .where(and(eq(bookings.flatId, flat.flatId), eq(bookings.status, "CONFIRMED"), gte(bookings.date, today)))
      .orderBy(asc(bookings.date), asc(bookings.startMinute)),
  ]);
  const nowMin = minuteNowIST();
  const chosen = sp.slot ? Number(sp.slot) : null;
  const href = (q: Record<string, string>) => `/amenities?${new URLSearchParams({ a: a.slug, d: day, ...q })}`;

  return (
    <div>
      <PageTitle title={t("a.title")} back={{ href: "/more", label: t("common.back") }} />
      {sp.done && (
        <Notice tone="emerald" icon={<CircleCheck className="size-4" aria-hidden />} className="mb-4">
          {t("a.done")} {a.feePaise > 0 && t("a.feeNote")}
        </Notice>
      )}
      {sp.err && (
        <Notice tone="red" icon={<TriangleAlert className="size-4" aria-hidden />} className="mb-4">
          {t(`a.err.${sp.err}` as Key, { n: sp.n ?? "" })}
        </Notice>
      )}

      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {list.map((x) => (
          <Link key={x.id} href={`/amenities?a=${x.slug}`} className={cx("whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ring-1", x.id === a.id ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-zinc-700 ring-zinc-200")}>
            {x.name}
          </Link>
        ))}
      </div>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold">{a.name}</p>
          <p className="text-sm text-zinc-600">
            {a.feePaise ? rupees(a.feePaise) : "Free"} · {a.slotMinutes / 60} h
          </p>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">{t("a.rules")}:</span> {a.rules} Up to {a.maxPerWeek} a week per flat; book up to {a.advanceDays} days ahead.
        </p>
      </Card>

      <Section title={t("a.pickDay")}>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {days.map((d) => (
            <Link key={d} href={href({ d })} className={cx("min-w-16 rounded-xl px-3 py-2 text-center text-sm ring-1", d === day ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-700 ring-zinc-200")}>
              {fmtDay(d, lang)}
            </Link>
          ))}
        </div>
      </Section>

      <Section title={t("a.pickSlot")}>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {slotsFor(a).map((m) => {
            const owner = taken.find((x) => x.startMinute === m)?.flatId;
            const past = day === today && m <= nowMin;
            const label = `${fmtMinute(m)} – ${fmtMinute(m + a.slotMinutes)}`;
            const state = owner === flat.flatId ? "yours" : owner ? "booked" : past ? "over" : "free";
            return (
              <li key={m}>
                {state === "free" ? (
                  <Link href={href({ slot: String(m) })} className={cx("flex h-14 flex-col items-center justify-center rounded-xl text-sm font-medium ring-1", chosen === m ? "bg-teal-700 text-white ring-teal-700" : "bg-white ring-zinc-300 hover:ring-teal-700")}>
                    {label}
                  </Link>
                ) : (
                  <div className={cx("flex h-14 flex-col items-center justify-center rounded-xl text-sm", state === "yours" ? "bg-teal-50 font-medium text-teal-800 ring-1 ring-teal-200" : "bg-zinc-100 text-zinc-400")}>
                    {label}
                    <span className="text-xs">{state === "yours" ? t("a.yours") : state === "booked" ? t("a.booked") : t("a.over")}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {chosen != null && slotsFor(a).includes(chosen) && (
        <Card className="sticky bottom-20 mt-4 shadow-lg">
          <p className="text-[15px] font-medium">
            {a.name}, {fmtDate(day, lang)}, {fmtMinute(chosen)} – {fmtMinute(chosen + a.slotMinutes)}
          </p>
          {a.feePaise > 0 && <p className="mt-0.5 text-sm text-zinc-600">{t("a.feeNote")}</p>}
          <form action={book.bind(null, a.id, day, chosen)} className="mt-3">
            <SubmitButton className="w-full">{t("a.book", { fee: a.feePaise ? rupees(a.feePaise) : "₹0" })}</SubmitButton>
          </form>
        </Card>
      )}

      <Section title={t("a.mine")}>
        {mine.length === 0 ? (
          <EmptyState icon={<CalendarDays className="size-5" aria-hidden />} title={t("a.none")} />
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-2xl bg-white ring-1 ring-zinc-200/80">
            {mine.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                <div>
                  <p className="text-[15px] font-medium">{b.name}</p>
                  <p className="text-xs text-zinc-500">
                    {fmtDay(b.date, lang)}, {fmtMinute(b.startMinute)} – {fmtMinute(b.startMinute + b.slot)}
                  </p>
                </div>
                {canCancel(b.date, b.startMinute) && (
                  <form action={cancelBooking.bind(null, b.id)}>
                    <SubmitButton size="sm" variant="ghost">
                      {t("a.cancel")}
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
