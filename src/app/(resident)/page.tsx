import { and, desc, eq, gte, isNull, ne, or } from "drizzle-orm";
import { CalendarDays, ChevronRight, CircleCheck, KeyRound, ReceiptIndianRupee, Siren, Wrench } from "lucide-react";
import Link from "next/link";
import { ComplaintStatus, VisitorStatus } from "@/components/badges";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, Badge, Card, EmptyState, LinkButton, Money, Section } from "@/components/ui";
import { db } from "@/db";
import { complaints, notices, visitors } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { fmtDate, fmtTime, relTime, shiftPeriod, startOfTodayIST, todayIST } from "@/lib/dates";
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
      .select({ id: complaints.id, title: complaints.title, description: complaints.description, category: complaints.category, status: complaints.status, urgency: complaints.urgency, createdAt: complaints.createdAt })
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

  return (
    <div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">{t("home.hello", { name: user.name.split(" ")[0] })}</h1>

      {waiting.map((v) => (
        <Card key={v.id} className="mt-4 bg-amber-50/60 ring-amber-200">
          <div className="flex items-center gap-3">
            {v.photoId ? (
              // eslint-disable-next-line @next/next/no-img-element -- private, access-checked photo route
              <img src={`/api/photos/${v.photoId}`} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <Avatar name={v.name} className="size-14 rounded-xl text-base" />
            )}
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-zinc-900">{t("home.atGate", { name: v.name, gate: v.gate })}</p>
              <p className="text-sm text-zinc-600">
                {t(`v.purpose.${v.purpose}` as Key)} · {relTime(v.arrivedAt, lang)}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <form action={decideVisitor.bind(null, v.id, "APPROVED")}>
              <SubmitButton className="w-full">{t("home.letIn")}</SubmitButton>
            </form>
            <form action={decideVisitor.bind(null, v.id, "DENIED")}>
              <SubmitButton variant="secondary" className="w-full">
                {t("home.deny")}
              </SubmitButton>
            </form>
          </div>
        </Card>
      ))}

      <Card className="mt-4">
        {pos.balance > 0 ? (
          <>
            <p className="text-sm text-zinc-500">{t("home.due")}</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums text-zinc-950">
              <Money paise={pos.balance} />
            </p>
            <div className="mt-2">
              {pos.daysOverdue > 0 ? (
                <Badge tone="red">{t("home.overdue", { days: pos.daysOverdue })}</Badge>
              ) : (
                nextDue && <span className="text-sm text-zinc-600">{t("home.dueBy", { date: fmtDate(nextDue, lang) })}</span>
              )}
            </div>
            <LinkButton href="/bills/pay" size="lg" className="mt-4 w-full">
              {t("home.pay", { amount: rupees(pos.balance) })}
            </LinkButton>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CircleCheck className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-[17px] font-semibold text-zinc-900">{t("home.paid")}</p>
              <p className="text-sm text-zinc-500">
                {pos.balance < 0 ? t("home.advance", { amount: rupees(-pos.balance) }) : t("home.nextBill", { date: fmtDate(`${shiftPeriod(today.slice(0, 7), 1)}-01`, lang) })}
              </p>
            </div>
          </div>
        )}
      </Card>

      <nav className="mt-4 grid grid-cols-4 gap-2" aria-label="Quick actions">
        {[
          { href: "/bills", icon: ReceiptIndianRupee, label: t("home.quick.pay") },
          { href: "/complaints/new", icon: Wrench, label: t("home.quick.complaint") },
          { href: "/visitors#codes", icon: KeyRound, label: t("home.quick.code") },
          { href: "/amenities", icon: CalendarDays, label: t("home.quick.book") },
        ].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white px-1 py-3 text-center text-xs font-medium text-zinc-700 ring-1 ring-zinc-200/80 hover:bg-zinc-50">
            <Icon className="size-5 text-teal-700" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      <Section title={t("home.complaints")} action={open.length > 0 && <Link href="/complaints" className="text-sm font-medium text-teal-800">{t("common.seeAll")}</Link>}>
        {open.length === 0 ? (
          <EmptyState title={t("home.noComplaints")}>
            <Link href="/complaints/new" className="font-medium text-teal-800">
              {t("home.raise")} →
            </Link>
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {open.map((c) => (
              <li key={c.id}>
                <Link href={`/complaints/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-zinc-200/80 hover:bg-zinc-50">
                  {c.urgency === "EMERGENCY" && <Siren className="size-5 shrink-0 text-red-600" aria-label="Emergency" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-zinc-900">{c.title ?? c.description}</p>
                    <p className="text-xs text-zinc-500">
                      {t(`cat.${c.category}` as Key)} · {relTime(c.createdAt, lang)}
                    </p>
                  </div>
                  <ComplaintStatus status={c.status} t={t} />
                  <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("home.visitorsToday")}>
        {todays.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("home.noVisitors")}</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-2xl bg-white ring-1 ring-zinc-200/80">
            {todays.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-3.5 py-3">
                <Avatar name={v.name} className="size-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-zinc-900">{v.name}</p>
                  <p className="text-xs text-zinc-500">{t("v.at", { gate: v.gate, time: fmtTime(v.arrivedAt, lang) })}</p>
                </div>
                <VisitorStatus status={v.status} t={t} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {latest.length > 0 && (
        <Section title={t("home.notices")} action={<Link href="/more#notices" className="text-sm font-medium text-teal-800">{t("common.seeAll")}</Link>}>
          <ul className="space-y-2">
            {latest.map((n) => (
              <li key={n.id} className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-200/80">
                <p className="text-[15px] font-medium text-zinc-900">{n.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600">{n.body}</p>
                <p className="mt-1 text-xs text-zinc-400">{relTime(n.createdAt, lang)}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
