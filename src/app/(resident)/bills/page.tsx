import { desc, eq } from "drizzle-orm";
import { ArrowDownLeft, CalendarDays, Info, Percent, ReceiptText, Undo2, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DuesCard } from "@/components/dues-card";
import { Card, cardCls, cx, EmptyState, IconChip, Notice, PageTitle, Section, type Tone } from "@/components/ui";
import { db } from "@/db";
import { bills, ledger } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { withRunningBalance } from "@/lib/billing";
import { fmtDate, fmtMonth, todayIST } from "@/lib/dates";
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

// Each kind of ledger line gets its own icon, so the history scans at a glance.
const KIND: Record<string, [LucideIcon, Tone]> = {
  MAINTENANCE: [ReceiptText, "zinc"],
  INTEREST: [Percent, "amber"],
  PAYMENT: [ArrowDownLeft, "brand"],
  AMENITY: [CalendarDays, "sky"],
  REVERSAL: [Undo2, "red"],
  ADJUSTMENT: [ReceiptText, "violet"],
};

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

  return (
    <div>
      <PageTitle title={t("bills.title")} />

      <DuesCard pos={pos} t={t} lang={lang} today={todayIST()} />

      {bill && (
        <Section title={t("bills.bill", { month: fmtMonth(bill.period, lang) })}>
          <Card>
            <dl className="space-y-3 text-[15px]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">{t("bills.maintenance", { area: bill.areaSqft })}</dt>
                <dd className="font-medium tabular-nums">{rupees(bill.maintenance)}</dd>
              </div>
              {bill.interest > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">{t("bills.interest")}</dt>
                  <dd className="font-medium tabular-nums">{rupees(bill.interest)}</dd>
                </div>
              )}
              {bill.arrears !== 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">{bill.arrears > 0 ? t("bills.arrears") : t("bills.arrearsCredit")}</dt>
                  <dd className="font-medium tabular-nums">{bill.arrears > 0 ? rupees(bill.arrears) : `− ${rupees(-bill.arrears)}`}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-dashed border-ink/15 pt-3 text-base font-semibold">
                <dt>{t("bills.total")}</dt>
                <dd className="tabular-nums">{rupees(bill.maintenance + bill.interest + bill.arrears)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-ink-3">
              {t("home.dueBy", { date: fmtDate(bill.dueDate, lang) })}. {t("bills.interestNote")}
            </p>
          </Card>
        </Section>
      )}

      <Notice tone="brand" icon={<Info className="size-4" aria-hidden />} className="mt-4">
        {t("bills.bankTip", { flat: flat.flatId.replace("-", " ") })}
      </Notice>

      <Section title={t("bills.history")}>
        {history.length === 0 ? (
          <EmptyState icon={<ReceiptText className="size-5" aria-hidden />} title={t("bills.empty")} />
        ) : (
          <ul className={cx(cardCls, "divide-y divide-line !px-0 !py-1")}>
            {history.slice(0, 40).map((r) => {
              const credit = r.amount < 0;
              const [Icon, tone] = KIND[r.kind] ?? KIND.ADJUSTMENT;
              const inner = (
                <>
                  <IconChip tone={tone}>
                    <Icon className="size-5" aria-hidden />
                  </IconChip>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink">{label(r, t, lang)}</p>
                    <p className="text-xs text-ink-3">
                      {fmtDate(r.date, lang)}
                      {r.paymentId && credit && ` · ${t("bills.receipt")} →`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[15px] font-semibold tabular-nums ${credit ? "text-accent-ink" : "text-ink"}`}>{credit ? `− ${rupees(-r.amount)}` : rupees(r.amount)}</p>
                    <p className="text-xs tabular-nums text-ink-3">{rupees(r.balance)}</p>
                  </div>
                </>
              );
              return (
                <li key={r.id}>
                  {r.paymentId && credit ? (
                    <Link href={`/receipts/${r.paymentId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
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
