import { and, asc, eq, gte } from "drizzle-orm";
import { CalendarDays, CircleCheck, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { cardCls, cx, EmptyState, IconChip, Notice, PageTitle, Section } from "@/components/ui";
import { db } from "@/db";
import { amenities, bookings } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { canCancel, fmtMinute, minuteNowIST, slotsFor } from "@/lib/amenities";
import { addDays, dayParts, fmtDate, fmtDay, todayIST } from "@/lib/dates";
import { getLang } from "@/lib/lang";
import { translator, type Key } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import { book, cancelBooking } from "./actions";
import { AmenityArt } from "./amenity-art";

export const metadata: Metadata = { title: "Book an amenity" };

type Search = { a?: string; d?: string; slot?: string; err?: string; n?: string; done?: string; cancelled?: string };
const ERRORS = ["slot", "past", "window", "dues", "limit", "taken", "cancelLate"];
// Sideways lists run to the screen edge, snap, and hide the desktop scrollbar (a cut-off chip shows there is more).
const scroller = "-mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none]";
const pill = (on: boolean) => (on ? "bg-cta text-cta-ink" : "bg-surface text-ink-2 shadow-[0_1px_2px_rgb(18_18_18/0.05)] ring-1 ring-line");

export default async function AmenitiesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { flat } = await requireResident();
  const lang = await getLang();
  const t = translator(lang);
  const sp = await searchParams;
  const list = await db.select().from(amenities).orderBy(asc(amenities.id));
  const a = list.find((x) => x.slug === sp.a) ?? list[0];
  const today = todayIST();
  const days = Array.from({ length: Math.min(a.advanceDays, 30) + 1 }, (_, i) => addDays(today, i));
  const day = sp.d && days.includes(sp.d) ? sp.d : today;
  const [taken, mine] = await Promise.all([
    db.select({ startMinute: bookings.startMinute, flatId: bookings.flatId }).from(bookings).where(and(eq(bookings.amenityId, a.id), eq(bookings.date, day), eq(bookings.status, "CONFIRMED"))),
    db
      .select({ id: bookings.id, date: bookings.date, startMinute: bookings.startMinute, name: amenities.name, slug: amenities.slug, slot: amenities.slotMinutes })
      .from(bookings)
      .innerJoin(amenities, eq(amenities.id, bookings.amenityId))
      .where(and(eq(bookings.flatId, flat.flatId), eq(bookings.status, "CONFIRMED"), gte(bookings.date, today)))
      .orderBy(asc(bookings.date), asc(bookings.startMinute)),
  ]);
  const nowMin = minuteNowIST();
  const chosen = sp.slot ? Number(sp.slot) : null;
  const err = sp.err && ERRORS.includes(sp.err) ? sp.err : null;
  const href = (q: Record<string, string>) => `/amenities?${new URLSearchParams({ a: a.slug, d: day, ...q })}`;

  return (
    <div>
      <PageTitle title={t("a.title")} back={{ href: "/more", label: t("common.back") }} />
      {(sp.done || sp.cancelled) && (
        <Notice tone="emerald" icon={<CircleCheck className="size-4" aria-hidden />} className="mb-4">
          {sp.done ? `${t("a.done")} ${a.feePaise > 0 ? t("a.feeNote") : ""}` : t("a.cancelled")}
        </Notice>
      )}
      {err && (
        <Notice tone="red" icon={<TriangleAlert className="size-4" aria-hidden />} className="mb-4">
          {t(`a.err.${err}` as Key, { n: sp.n ?? "" })}
        </Notice>
      )}

      <div className={cx(scroller, "mb-3")}>
        {list.map((x) => (
          <Link key={x.id} href={`/amenities?a=${x.slug}`} aria-current={x.id === a.id ? "page" : undefined} className={cx("press shrink-0 snap-start whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold", pill(x.id === a.id))}>
            {x.name}
          </Link>
        ))}
      </div>

      <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#eef8d6,#fdf1e2)] dark:bg-[linear-gradient(135deg,#1f2616,#2a2118)]">
        <div className="flex items-center gap-2 p-5 pb-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold leading-tight text-ink">{a.name}</h2>
            <p className="mt-1 text-sm font-medium text-ink-2">
              {a.feePaise ? rupees(a.feePaise) : t("a.free")} · {a.slotMinutes / 60} h
            </p>
          </div>
          <AmenityArt slug={a.slug} className="size-24 shrink-0" />
        </div>
        <p className="p-5 pt-3 text-sm leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">{t("a.rules")}:</span> {a.rules} {t("a.limits", { max: a.maxPerWeek, days: a.advanceDays })}
        </p>
      </section>

      <Section title={t("a.pickDay")}>
        <div className={scroller}>
          {days.map((d) => {
            const p = dayParts(d, lang);
            return (
              <Link key={d} href={href({ d })} aria-current={d === day ? "date" : undefined} className={cx("press flex w-16 shrink-0 snap-start flex-col items-center rounded-[22px] py-3", pill(d === day))}>
                <span className="text-xs font-medium opacity-80">{p.weekday}</span>
                <span className="text-xl font-semibold leading-tight tabular-nums">{p.day}</span>
                <span className="text-xs opacity-80">{p.month}</span>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section title={t("a.pickSlot")}>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {slotsFor(a).map((m) => {
            const owner = taken.find((x) => x.startMinute === m)?.flatId;
            const past = day === today && m <= nowMin;
            const label = `${fmtMinute(m)} – ${fmtMinute(m + a.slotMinutes)}`;
            const state = owner === flat.flatId ? "yours" : owner ? "booked" : past ? "over" : "free";
            return (
              <li key={m}>
                {state === "free" ? (
                  <Link href={href({ slot: String(m) })} aria-current={chosen === m ? "true" : undefined} className={cx("press flex h-14 items-center justify-center rounded-full text-sm font-semibold", pill(chosen === m))}>
                    {label}
                  </Link>
                ) : (
                  <div className={cx("flex h-14 flex-col items-center justify-center rounded-full text-sm leading-tight", state === "yours" ? "bg-accent-soft font-semibold text-accent-ink" : "bg-ink/5 text-ink-3")}>
                    {label}
                    <span className="text-[11px]">{state === "yours" ? t("a.yours") : state === "booked" ? t("a.booked") : t("a.over")}</span>
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
          <p className="px-1 text-[15px] font-semibold">
            {a.name}, {fmtDate(day, lang)}, {fmtMinute(chosen)} – {fmtMinute(chosen + a.slotMinutes)}
          </p>
          {a.feePaise > 0 && <p className="mt-0.5 px-1 text-sm text-ink-2">{t("a.feeNote")}</p>}
          <form action={book.bind(null, a.id, day, chosen)} className="mt-3">
            <SubmitButton className="w-full">{t("a.book", { fee: a.feePaise ? rupees(a.feePaise) : "₹0" })}</SubmitButton>
          </form>
        </div>
      )}

      <Section title={t("a.mine")}>
        {mine.length === 0 ? (
          <EmptyState icon={<CalendarDays className="size-5" aria-hidden />} title={t("a.none")} />
        ) : (
          <ul className={cx(cardCls, "divide-y divide-line !py-1")}>
            {mine.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-3">
                <IconChip tone="sky">
                  <AmenityArt slug={b.slug} className="size-7" />
                </IconChip>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{b.name}</p>
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
