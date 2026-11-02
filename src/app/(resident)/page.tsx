import { and, desc, eq, gte, isNull, ne, or } from "drizzle-orm";
import { CalendarDays, KeyRound, Megaphone, ReceiptIndianRupee, Wrench } from "lucide-react";
import Link from "next/link";
import { VisitorStatus } from "@/components/badges";
import { ComplaintRow } from "@/components/complaint-row";
import { DuesCard } from "@/components/dues-card";
import { Avatar, cardCls, cx, EmptyState, IconChip, Section, SeeAll, type Tone } from "@/components/ui";
import { db } from "@/db";
import { complaints, notices, visitors } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { fmtLongDate, fmtTime, relTime, startOfTodayIST, todayIST } from "@/lib/dates";
import { flatPosition } from "@/lib/data";
import { getLang } from "@/lib/lang";
import { translator } from "@/lib/i18n";
import { GateRequest } from "./gate-request";

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
  const quick: { href: string; icon: typeof Wrench; label: string; tone: Tone }[] = [
    { href: "/bills", icon: ReceiptIndianRupee, label: t("home.quick.pay"), tone: "brand" },
    { href: "/complaints/new", icon: Wrench, label: t("home.quick.complaint"), tone: "peach" },
    { href: "/visitors#codes", icon: KeyRound, label: t("home.quick.code"), tone: "violet" },
    { href: "/amenities", icon: CalendarDays, label: t("home.quick.book"), tone: "sky" },
  ];

  return (
    <div>
      <h1 className="mb-6 mt-1 px-1 text-[32px] font-semibold leading-[1.12] tracking-[-0.02em]">
        {t("home.hello", { name: user.name.split(" ")[0] })}
        <span className="block text-ink-3">{fmtLongDate(today, lang)}</span>
      </h1>

      {/* Phones: one column. From tablets: money and actions on the left, what's happening on the right. */}
      <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-6">
        <div>
          {waiting.length > 0 && (
            <div className="mb-4 space-y-3">
              {waiting.map((v) => (
                <GateRequest key={v.id} v={v} t={t} lang={lang} />
              ))}
            </div>
          )}

          <DuesCard pos={pos} t={t} lang={lang} today={today} />

          <nav className="mt-4 grid grid-cols-4 gap-2.5" aria-label="Quick actions">
            {quick.map(({ href, icon: Icon, label, tone }) => (
              <Link key={href} href={href} className={cx(cardCls, "press flex flex-col items-center gap-2.5 !rounded-[24px] !px-1 !py-4 text-center text-xs font-semibold leading-tight text-ink-2")}>
                <IconChip tone={tone} className="size-12">
                  <Icon className="size-[22px]" aria-hidden />
                </IconChip>
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="md:[&>section:first-child]:mt-0">
          <Section title={t("home.complaints")} action={open.length > 0 && <SeeAll href="/complaints">{t("common.seeAll")}</SeeAll>}>
            {open.length === 0 ? (
              <EmptyState icon={<Wrench className="size-5" aria-hidden />} title={t("home.noComplaints")}>
                <Link href="/complaints/new" className="font-semibold text-accent-ink">
                  {t("home.raise")} →
                </Link>
              </EmptyState>
            ) : (
              <ul className="space-y-3">
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
              <ul className={cx(cardCls, "divide-y divide-line !py-1")}>
                {todays.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 py-3">
                    <Avatar name={v.name} className="size-11 text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{v.name}</p>
                      <p className="text-xs text-ink-3">{t("v.at", { gate: v.gate, time: fmtTime(v.arrivedAt, lang) })}</p>
                    </div>
                    <VisitorStatus status={v.status} t={t} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {latest.length > 0 && (
            <Section title={t("home.notices")} action={<SeeAll href="/more#notices">{t("common.seeAll")}</SeeAll>}>
              <ul className="space-y-3">
                {latest.map((n) => (
                  <li key={n.id} className={cx(cardCls, "flex gap-3.5")}>
                    <IconChip tone="zinc">
                      <Megaphone className="size-5" aria-hidden />
                    </IconChip>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold leading-snug">{n.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-2">{n.body}</p>
                      <p className="mt-1.5 text-xs text-ink-3">{relTime(n.createdAt, lang)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
