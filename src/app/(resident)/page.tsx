import { and, desc, eq, gte, isNull, ne, or } from "drizzle-orm";
import { CalendarClock, CalendarDays, CircleCheck, KeyRound, Megaphone, ReceiptIndianRupee, TriangleAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { VisitorStatus } from "@/components/badges";
import { ComplaintRow } from "@/components/complaint-row";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, cardCls, cx, EmptyState, IconChip, Section, type Tone } from "@/components/ui";
import { db } from "@/db";
import { complaints, notices, visitors } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { fmtDate, fmtLongDate, fmtTime, relTime, shiftPeriod, startOfTodayIST, todayIST } from "@/lib/dates";
import { flatPosition } from "@/lib/data";
import { getLang } from "@/lib/lang";
import { translator, type Key } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import { decideVisitor } from "./visitors/actions";

export default async function HomePage() {
  const { user, flat } = await requireResident();
  const lang = await getLang();
  const t = translator(lang);
  const today = todayIST();
  const visitorCols = { id: visitors.id, name: visitors.name, purpose: visitors.purpose, gate: visitors.gate, status: visitors.status, photoId: visitors.photoId, arrivedAt: visitors.arrivedAt };

  const [pos, waiting, todays, open, latest] = await Promise.all([
    flatPosition(flat.flatId),
    db.select(visitorCols).from(visitors).where(and(eq(visitors.flatId, flat.flatId), eq(visitors.status, "PENDING"))).orderBy(desc(visitors.arrivedAt)),
    db
      .select(visitorCols)
      .from(visitors)
      .where(and(eq(visitors.flatId, flat.flatId), ne(visitors.status, "PENDING"), gte(visitors.arrivedAt, startOfTodayIST())))
      .orderBy(desc(visitors.arrivedAt))
      .limit(5),
    db
      .select({ id: complaints.id, description: complaints.description, category: complaints.category, status: complaints.status, urgency: complaints.urgency, createdAt: complaints.createdAt })
      .from(complaints)
      .where(and(eq(complaints.flatId, flat.flatId), ne(complaints.status, "CLOSED")))
      .orderBy(desc(complaints.createdAt))
      .limit(3),
    db
      .select({ id: notices.id, title: notices.title, body: notices.body, createdAt: notices.createdAt })
      .from(notices)
      .where(or(isNull(notices.tower), eq(notices.tower, flat.tower)))
      .orderBy(desc(notices.createdAt))
      .limit(2),
  ]);
  const nextDue = pos.items.find((i) => i.unpaid > 0)?.charge.dueDate;
  const quick: { href: string; icon: typeof Wrench; label: string; tone: Tone }[] = [
    { href: "/bills", icon: ReceiptIndianRupee, label: t("home.quick.pay"), tone: "teal" },
    { href: "/complaints/new", icon: Wrench, label: t("home.quick.complaint"), tone: "amber" },
    { href: "/visitors#codes", icon: KeyRound, label: t("home.quick.code"), tone: "violet" },
    { href: "/amenities", icon: CalendarDays, label: t("home.quick.book"), tone: "sky" },
  ];

  return (
    <div>
      <div className="mb-5 mt-1 px-1">
        <p className="text-sm font-semibold text-ink-3">{fmtLongDate(today, lang)}</p>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight">{t("home.hello", { name: user.name.split(" ")[0] })}</h1>
      </div>

      {/* Someone at the gate is the most time-critical thing on this screen, so it comes first. */}
      {waiting.map((v) => (
        <section key={v.id} className="mb-4 rounded-[28px] bg-amber-50 p-4 ring-1 ring-amber-200/80 dark:bg-amber-400/10 dark:ring-amber-300/20" aria-live="polite">
          <div className="flex items-center gap-3.5">
            {v.photoId ? (
              // eslint-disable-next-line @next/next/no-img-element -- private, access-checked photo route
              <img src={`/api/photos/${v.photoId}`} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
            ) : (
              <Avatar name={v.name} className="size-16 rounded-2xl text-lg" />
            )}
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full rounded-full bg-amber-500 opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                </span>
                {t("v.waiting")}
              </p>
              <p className="mt-0.5 text-[17px] font-bold leading-snug">{t("home.atGate", { name: v.name, gate: v.gate })}</p>
              <p className="text-sm text-ink-2">
                {t(`v.purpose.${v.purpose}` as Key)} · {relTime(v.arrivedAt, lang)}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <form action={decideVisitor.bind(null, v.id, "APPROVED")}>
              <SubmitButton className="w-full">{t("home.letIn")}</SubmitButton>
            </form>
            <form action={decideVisitor.bind(null, v.id, "DENIED")}>
              <SubmitButton variant="secondary" className="w-full">
                {t("home.deny")}
              </SubmitButton>
            </form>
          </div>
        </section>
      ))}

      <section className="hero relative overflow-hidden rounded-[28px] p-5">
        {pos.balance > 0 ? (
          <div className="relative">
            <p className="text-sm font-semibold text-white/75">{t("home.due")}</p>
            <p className="mt-1 text-[44px] font-bold leading-none tracking-tight tabular-nums">{rupees(pos.balance)}</p>
            <div className="mt-3">
              {pos.daysOverdue > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-sm font-semibold">
                  <TriangleAlert className="size-4 text-amber-300" aria-hidden /> {t("home.overdue", { days: pos.daysOverdue })}
                </span>
              ) : (
                nextDue && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
                    <CalendarClock className="size-4" aria-hidden /> {t("home.dueBy", { date: fmtDate(nextDue, lang) })}
                  </span>
                )
              )}
            </div>
            <Link href="/bills/pay" className="press mt-5 flex h-14 items-center justify-center rounded-2xl bg-white text-base font-bold text-[#0a4b43] shadow-[0_10px_24px_-10px_rgb(0_0_0/0.45)]">
              {t("home.pay", { amount: rupees(pos.balance) })}
            </Link>
          </div>
        ) : (
          <div className="relative flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <CircleCheck className="size-8" aria-hidden />
            </span>
            <div>
              <p className="text-xl font-bold">{t("home.paid")}</p>
              <p className="text-sm text-white/75">
                {pos.balance < 0 ? t("home.advance", { amount: rupees(-pos.balance) }) : t("home.nextBill", { date: fmtDate(`${shiftPeriod(today.slice(0, 7), 1)}-01`, lang) })}
              </p>
            </div>
          </div>
        )}
      </section>

      <nav className="mt-4 grid grid-cols-4 gap-2.5" aria-label="Quick actions">
        {quick.map(({ href, icon: Icon, label, tone }) => (
          <Link key={href} href={href} className={cx(cardCls, "press flex flex-col items-center gap-2 !p-3 text-center text-xs font-semibold text-ink-2")}>
            <IconChip tone={tone} className="size-11">
              <Icon className="size-[22px]" aria-hidden />
            </IconChip>
            {label}
          </Link>
        ))}
      </nav>

      <Section title={t("home.complaints")} action={open.length > 0 && <Link href="/complaints" className="text-sm font-semibold text-accent-ink">{t("common.seeAll")}</Link>}>
        {open.length === 0 ? (
          <EmptyState icon={<Wrench className="size-5" aria-hidden />} title={t("home.noComplaints")}>
            <Link href="/complaints/new" className="font-semibold text-accent-ink">
              {t("home.raise")} →
            </Link>
          </EmptyState>
        ) : (
          <ul className="space-y-2.5">
            {open.map((c) => (
              <li key={c.id}>
                <ComplaintRow c={c} t={t} lang={lang} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("home.visitorsToday")}>
        {todays.length === 0 ? (
          <p className="px-1 text-sm text-ink-3">{t("home.noVisitors")}</p>
        ) : (
          <ul className={cx(cardCls, "divide-y divide-line !p-0")}>
            {todays.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={v.name} className="size-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{v.name}</p>
                  <p className="text-xs text-ink-3">{t("v.at", { gate: v.gate, time: fmtTime(v.arrivedAt, lang) })}</p>
                </div>
                <VisitorStatus status={v.status} t={t} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {latest.length > 0 && (
        <Section title={t("home.notices")} action={<Link href="/more#notices" className="text-sm font-semibold text-accent-ink">{t("common.seeAll")}</Link>}>
          <ul className="space-y-2.5">
            {latest.map((n) => (
              <li key={n.id} className={cx(cardCls, "flex gap-3 !p-3.5")}>
                <IconChip tone="zinc">
                  <Megaphone className="size-5" aria-hidden />
                </IconChip>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-snug">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-2">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-3">{relTime(n.createdAt, lang)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
