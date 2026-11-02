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
import { addDays, dayParts, fmtDate, fmtDay, todayIST } from "@/lib/dates";
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
  // Sideways lists run to the screen edge, snap, and hide the desktop scrollbar (a cut-off chip shows there is more).
  const scroller = "-mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none]";

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

      <div className={cx(scroller, "mb-4")}>
        {list.map((x) => (
          <Link key={x.id} href={`/amenities?a=${x.slug}`} aria-current={x.id === a.id ? "page" : undefined} className={cx("press shrink-0 snap-start whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ring-1", x.id === a.id ? "bg-accent text-white ring-accent" : "bg-surface text-ink-2 ring-line")}>
            {x.name}
          </Link>
        ))}
      </div>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold">{a.name}</p>
          <p className="text-sm text-ink-2">
            {a.feePaise ? rupees(a.feePaise) : t("a.free")} · {a.slotMinutes / 60} h
          </p>
        </div>
        <p className="mt-1 text-sm text-ink-2">
          <span className="font-semibold">{t("a.rules")}:</span> {a.rules} {t("a.limits", { max: a.maxPerWeek, days: a.advanceDays })}
        </p>
      </Card>

      <Section title={t("a.pickDay")}>
        <div className={scroller}>
          {days.map((d) => {
            const p = dayParts(d, lang);
            const on = d === day;
            return (
              <Link key={d} href={href({ d })} aria-current={on ? "date" : undefined} className={cx("press flex w-16 shrink-0 snap-start flex-col items-center rounded-2xl py-2.5 ring-1", on ? "bg-accent text-white ring-accent" : "bg-surface text-ink-2 ring-line")}>
                <span className="text-xs font-semibold">{p.weekday}</span>
                <span className="text-xl font-bold leading-tight tabular-nums">{p.day}</span>
                <span className="text-xs">{p.month}</span>
              </Link>
            );
          })}
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
                  <Link href={href({ slot: String(m) })} aria-current={chosen === m ? "true" : undefined} className={cx("press flex h-14 flex-col items-center justify-center rounded-2xl text-sm font-semibold ring-1", chosen === m ? "bg-accent text-white ring-accent" : "bg-surface ring-line hover:ring-accent/50")}>
                    {label}
                  </Link>
                ) : (
                  <div className={cx("flex h-14 flex-col items-center justify-center rounded-2xl text-sm", state === "yours" ? "bg-accent-soft font-semibold text-accent-ink ring-1 ring-accent/30" : "bg-muted text-ink-3")}>
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
        // A sheet on the floating layer, just above the tab bar, so the choice stays in reach while you scroll.
        <div className="glass sticky bottom-28 z-10 mt-4 rounded-[28px] p-4 motion-safe:animate-sheet">
          <p className="text-[15px] font-semibold">
            {a.name}, {fmtDate(day, lang)}, {fmtMinute(chosen)} – {fmtMinute(chosen + a.slotMinutes)}
          </p>
          {a.feePaise > 0 && <p className="mt-0.5 text-sm text-ink-2">{t("a.feeNote")}</p>}
          <form action={book.bind(null, a.id, day, chosen)} className="mt-3">
            <SubmitButton className="w-full">{t("a.book", { fee: a.feePaise ? rupees(a.feePaise) : "₹0" })}</SubmitButton>
          </form>
        </div>
      )}

      <Section title={t("a.mine")}>
        {mine.length === 0 ? (
          <EmptyState icon={<CalendarDays className="size-5" aria-hidden />} title={t("a.none")} />
        ) : (
          <ul className="divide-y divide-line card">
            {mine.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                <div>
                  <p className="text-[15px] font-medium">{b.name}</p>
                  <p className="text-xs text-ink-3">
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
