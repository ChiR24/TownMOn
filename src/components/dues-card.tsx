import { ArrowUpRight, CalendarClock, CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { position } from "@/lib/billing";
import { fmtDate, shiftPeriod } from "@/lib/dates";
import type { T } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import { ProgressBar } from "./viz";

type Position = ReturnType<typeof position>;

/** The dues hero on Home and Bills: what the flat owes, how late it is, and the one action, Pay. */
export function DuesCard({ pos, t, lang, today }: { pos: Position; t: T; lang: string; today: string }) {
  if (pos.balance <= 0) {
    return (
      <section className="hero flex items-center gap-4 rounded-[32px] p-6">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-[#121212]">
          <CircleCheck className="size-7" aria-hidden />
        </span>
        <div>
          <p className="text-xl font-semibold">{t("home.paid")}</p>
          <p className="mt-0.5 text-sm text-white/65">
            {pos.balance < 0 ? t("home.advance", { amount: rupees(-pos.balance) }) : t("home.nextBill", { date: fmtDate(`${shiftPeriod(today.slice(0, 7), 1)}-01`, lang) })}
          </p>
        </div>
      </section>
    );
  }
  const nextDue = pos.items.find((i) => i.unpaid > 0)?.charge.dueDate;
  // A bill paid in part shows how far along it is (T21-1601: ₹5,000 of ₹10,660).
  const part = pos.items.find((i) => i.charge.kind === "MAINTENANCE" && i.unpaid > 0 && i.unpaid < i.charge.amount);
  return (
    <section className="hero rounded-[32px] p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white/65">{t("home.due")}</p>
        {pos.daysOverdue > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
            <TriangleAlert className="size-3.5" aria-hidden /> {t("home.overdue", { days: pos.daysOverdue })}
          </span>
        ) : (
          nextDue && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">
              <CalendarClock className="size-3.5" aria-hidden /> {t("home.dueBy", { date: fmtDate(nextDue, lang) })}
            </span>
          )
        )}
      </div>
      <p className="mt-3 text-[46px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{rupees(pos.balance)}</p>
      {part && (
        <div className="mt-5">
          <p className="mb-2 text-xs text-white/65">{t("home.partPaid", { paid: rupees(part.charge.amount - part.unpaid), of: rupees(part.charge.amount) })}</p>
          <ProgressBar onDark value={(part.charge.amount - part.unpaid) / part.charge.amount} label={t("home.partPaid", { paid: rupees(part.charge.amount - part.unpaid), of: rupees(part.charge.amount) })} />
        </div>
      )}
      <Link href="/bills/pay" className="press mt-6 flex h-14 items-center justify-between rounded-full bg-accent pl-6 pr-1.5 text-base font-semibold text-[#121212]">
        {t("home.pay", { amount: rupees(pos.balance) })}
        <span className="flex size-11 items-center justify-center rounded-full bg-[#121212] text-accent">
          <ArrowUpRight className="size-5" aria-hidden />
        </span>
      </Link>
    </section>
  );
}
