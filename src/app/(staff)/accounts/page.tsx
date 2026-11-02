import { and, count, desc, eq, gte, isNull, sql, sum } from "drizzle-orm";
import { ArrowRight, Download, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { Card, cx, inputCls, PageTitle, Section } from "@/components/ui";
import { db } from "@/db";
import { bankImports, bankTxns, bills, flats, payments, users } from "@/db/schema";
import { AREAS, requireUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { daysAgo, fmtDateTime, fmtMonth, todayIST } from "@/lib/dates";
import { rupees } from "@/lib/money";
import { findFlat, runBills } from "./actions";
import { UploadForm } from "./forms";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  await requireUser(AREAS.accounts);
  const period = todayIST().slice(0, 7);
  const monthAgo = daysAgo(30);
  const [[billed], [collected], [queue], matching, imports, [billCount], [flatCount]] = await Promise.all([
    db.select({ total: sum(sql`${bills.maintenance} + ${bills.interest}`) }).from(bills).where(eq(bills.period, period)),
    db.select({ total: sum(payments.amount) }).from(payments).where(and(gte(payments.paidOn, `${period}-01`), isNull(payments.reversedAt))),
    db.select({ n: count() }).from(bankTxns).where(eq(bankTxns.status, "NEEDS_REVIEW")),
    db.select({ status: bankTxns.status, n: count() }).from(bankTxns).where(gte(bankTxns.createdAt, monthAgo)).groupBy(bankTxns.status),
    db
      .select({ id: bankImports.id, fileName: bankImports.fileName, createdAt: bankImports.createdAt, credits: bankImports.credits, autoMatched: bankImports.autoMatched, needsReview: bankImports.needsReview, duplicates: bankImports.duplicates, by: users.name })
      .from(bankImports)
      .innerJoin(users, eq(users.id, bankImports.uploadedBy))
      .orderBy(desc(bankImports.id))
      .limit(8),
    db.select({ n: count() }).from(bills).where(eq(bills.period, period)),
    db.select({ n: count() }).from(flats),
  ]);
  const n = (s: string) => matching.find((m) => m.status === s)?.n ?? 0;
  const resident = n("AUTO_MATCHED") + n("MATCHED");
  const autoRate = resident ? Math.round((100 * n("AUTO_MATCHED")) / resident) : 0;
  const billedP = Number(billed?.total ?? 0);
  const collectedP = Number(collected?.total ?? 0);

  const stats = [
    { label: `Billed for ${fmtMonth(period)}`, value: rupees(billedP), note: `${billCount.n.toLocaleString("en-IN")} of ${flatCount.n.toLocaleString("en-IN")} flats`, tone: "tile-lime" },
    { label: "Collected this month", value: rupees(collectedP), note: billedP ? `${Math.round((100 * collectedP) / billedP)}% of this month's billing` : "", tone: "tile-mint" },
    { label: "Waiting for review", value: queue.n.toLocaleString("en-IN"), note: "Never posted until someone decides", href: "/accounts/review", tone: "tile-peach" },
    { label: "Matched automatically", value: `${autoRate}%`, note: "Resident payments, last 30 days", tone: "tile-lavender" },
  ];

  return (
    <div>
      <PageTitle title="Accounts" subtitle="Bank statement matching, receipts and the monthly bill run." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const body = (
            <>
              <p className="text-sm font-medium text-ink-2">{s.label}</p>
              <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums">{s.value}</p>
              <p className="mt-2 text-xs text-ink-3">{s.note}</p>
            </>
          );
          const cls = cx(s.tone, "block rounded-[24px] p-5");
          return s.href ? (
            <Link key={s.label} href={s.href} className={cx(cls, "press hover:brightness-[0.98]")}>
              {body}
            </Link>
          ) : (
            <div key={s.label} className={cls}>
              {body}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-semibold">Import a bank statement</h2>
          <p className="mt-1 text-sm text-ink-2">
            Upload the CSV from net banking. A credit is posted to a flat only when two things agree: the flat number in the note, a UPI ID that has paid for that flat before, the exact dues, or the payer&apos;s name. Everything else waits in the review queue. Lines already imported are skipped.
          </p>
          <div className="mt-4">
            <UploadForm />
          </div>
          {DEMO_MODE && (
            <a href="/accounts/sample-statement" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-ink hover:text-accent-ink">
              <Download className="size-4" aria-hidden /> Download a sample statement for today (demo)
            </a>
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold">Find a flat</h2>
            <form action={findFlat} className="mt-3 flex gap-2">
              <input name="q" required placeholder="T07-1203" aria-label="Flat number" className={`${inputCls} py-2`} />
              <SubmitButton size="sm" className="h-11" aria-label="Find">
                <Search className="size-4" aria-hidden />
              </SubmitButton>
            </form>
          </Card>
          <Card>
            <h2 className="font-semibold">Monthly bills</h2>
            {billCount.n >= flatCount.n ? (
              <p className="mt-1 text-sm text-ink-2">All {flatCount.n.toLocaleString("en-IN")} bills for {fmtMonth(period)} are out. Next month&apos;s run happens automatically on the 1st.</p>
            ) : (
              <form action={runBills} className="mt-2 space-y-2">
                <p className="text-sm text-ink-2">{(flatCount.n - billCount.n).toLocaleString("en-IN")} flats don&apos;t have a {fmtMonth(period)} bill yet.</p>
                <SubmitButton size="sm">Raise {fmtMonth(period)} bills</SubmitButton>
              </form>
            )}
            <p className="mt-2 text-xs text-ink-3">₹6.50 per sq ft. Due on the 15th. 21% a year simple interest on overdue maintenance.</p>
          </Card>
        </div>
      </div>

      <Section title="Recent imports">
        <div className="overflow-x-auto card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">Statement</th>
                <th className="px-4 py-3 font-medium">Imported</th>
                <th className="px-4 py-3 text-right font-medium">Credits</th>
                <th className="px-4 py-3 text-right font-medium">Posted itself</th>
                <th className="px-4 py-3 text-right font-medium">To review</th>
                <th className="px-4 py-3 text-right font-medium">Already seen</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {imports.map((i) => (
                <tr key={i.id} className="hover:bg-muted">
                  <td className="px-4 py-3 font-medium text-ink">{i.fileName}</td>
                  <td className="px-4 py-3 text-ink-2">
                    {fmtDateTime(i.createdAt)} · {i.by}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{i.credits}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{i.autoMatched}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-700">{i.needsReview}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-3">{i.duplicates}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/accounts/imports/${i.id}`} className="inline-flex items-center gap-1 font-medium text-accent-ink">
                      Open <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
