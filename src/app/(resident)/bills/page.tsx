import { desc, eq } from "drizzle-orm";
import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, LinkButton, Money, Notice, PageTitle, Section } from "@/components/ui";
import { db } from "@/db";
import { bills, ledger } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { withRunningBalance } from "@/lib/billing";
import { fmtDate, fmtMonth } from "@/lib/dates";
import { flatPosition } from "@/lib/data";
import { getLang } from "@/lib/lang";
import { translator, type T } from "@/lib/i18n";
import { rupees } from "@/lib/money";

export const metadata: Metadata = { title: "Bills" };

type Row = { kind: string; date: string; memo: string | null; billId: number | null };
function label(r: Row, t: T, lang: string) {
  if (r.kind === "MAINTENANCE" && r.billId) return t("bills.hist.maintenance", { month: fmtMonth(r.date.slice(0, 7), lang) });
  if (r.kind === "INTEREST") return t("bills.interest");
  if (r.kind === "PAYMENT") return t("bills.hist.payment");
  if (r.kind === "AMENITY") return t("bills.hist.amenity");
  if (r.kind === "REVERSAL") return t("bills.hist.reversal");
  return r.memo ?? t("bills.hist.adjustment");
}

export default async function BillsPage() {
  const { flat } = await requireResident();
  const lang = await getLang();
  const t = translator(lang);
  const [pos, [bill], rows] = await Promise.all([
    flatPosition(flat.flatId),
    db.select().from(bills).where(eq(bills.flatId, flat.flatId)).orderBy(desc(bills.period)).limit(1),
    db
      .select({ id: ledger.id, kind: ledger.kind, amount: ledger.amount, date: ledger.date, memo: ledger.memo, billId: ledger.billId, paymentId: ledger.paymentId })
      .from(ledger)
      .where(eq(ledger.flatId, flat.flatId))
      .orderBy(ledger.date, ledger.id),
  ]);
  const history = withRunningBalance(rows);
  const nextDue = pos.items.find((i) => i.unpaid > 0)?.charge.dueDate;

  return (
    <div>
      <PageTitle title={t("bills.title")} />

      <Card>
        <p className="text-sm text-zinc-500">{t("bills.balance")}</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-3xl font-semibold tracking-tight">
            <Money paise={Math.max(0, pos.balance)} />
          </p>
          {pos.daysOverdue > 0 ? (
            <Badge tone="red">{t("home.overdue", { days: pos.daysOverdue })}</Badge>
          ) : pos.balance > 0 && nextDue ? (
            <span className="text-sm text-zinc-600">{t("home.dueBy", { date: fmtDate(nextDue, lang) })}</span>
          ) : pos.balance < 0 ? (
            <Badge tone="emerald">{t("home.advance", { amount: rupees(-pos.balance) })}</Badge>
          ) : null}
        </div>
        {pos.balance > 0 && (
          <LinkButton href="/bills/pay" size="lg" className="mt-4 w-full">
            {t("bills.payNow")}
          </LinkButton>
        )}
      </Card>

      {bill && (
        <Section title={t("bills.bill", { month: fmtMonth(bill.period, lang) })}>
          <Card>
            <dl className="space-y-2.5 text-[15px]">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-600">{t("bills.maintenance", { area: bill.areaSqft })}</dt>
                <dd className="tabular-nums">{rupees(bill.maintenance)}</dd>
              </div>
              {bill.interest > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-600">{t("bills.interest")}</dt>
                  <dd className="tabular-nums">{rupees(bill.interest)}</dd>
                </div>
              )}
              {bill.arrears !== 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-600">{bill.arrears > 0 ? t("bills.arrears") : t("bills.arrearsCredit")}</dt>
                  <dd className="tabular-nums">{bill.arrears > 0 ? rupees(bill.arrears) : `− ${rupees(-bill.arrears)}`}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-zinc-100 pt-2.5 font-semibold">
                <dt>{t("bills.total")}</dt>
                <dd className="tabular-nums">{rupees(bill.maintenance + bill.interest + bill.arrears)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-zinc-500">
              {t("home.dueBy", { date: fmtDate(bill.dueDate, lang) })}. {t("bills.interestNote")}
            </p>
          </Card>
        </Section>
      )}

      <Notice tone="teal" icon={<Info className="size-4" aria-hidden />} className="mt-4">
        {t("bills.bankTip", { flat: flat.flatId.replace("-", " ") })}
      </Notice>

      <Section title={t("bills.history")}>
        {history.length === 0 ? (
          <EmptyState title={t("bills.empty")} />
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-2xl bg-white ring-1 ring-zinc-200/80">
            {history.slice(0, 40).map((r) => {
              const credit = r.amount < 0;
              const inner = (
                <>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] text-zinc-900">{label(r, t, lang)}</p>
                    <p className="text-xs text-zinc-500">
                      {fmtDate(r.date, lang)}
                      {r.paymentId && credit && ` · ${t("bills.receipt")} →`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[15px] font-medium tabular-nums ${credit ? "text-emerald-700" : "text-zinc-900"}`}>{credit ? `− ${rupees(-r.amount)}` : rupees(r.amount)}</p>
                    <p className="text-xs tabular-nums text-zinc-400">{rupees(r.balance)}</p>
                  </div>
                </>
              );
              return (
                <li key={r.id}>
                  {r.paymentId && credit ? (
                    <Link href={`/receipts/${r.paymentId}`} className="flex items-center justify-between gap-3 px-3.5 py-3 hover:bg-zinc-50">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-3 px-3.5 py-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
