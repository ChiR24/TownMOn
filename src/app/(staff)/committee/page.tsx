import type { Metadata } from "next";
import Link from "next/link";
import { AgeingBars, Meter, PercentColumns, StatTile, StatusNote, type Status } from "@/components/charts";
import { Card, PageTitle, Section } from "@/components/ui";
import { db } from "@/db";
import { AREAS, requireUser } from "@/lib/auth";
import { fmtDate, fmtMonth, shiftPeriod, todayIST } from "@/lib/dates";
import { monthReport, onTimeTrend } from "@/lib/metrics";
import { compactINR } from "@/lib/money";

export const metadata: Metadata = { title: "Committee dashboard" };

const band = (v: number | null, good: number, warn: number, lowerIsBetter = false): Status =>
  v == null ? "warning" : lowerIsBetter ? (v < good ? "good" : v < warn ? "warning" : "critical") : v >= good ? "good" : v >= warn ? "warning" : "critical";
const shortMonth = (p: string) => new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(new Date(`${p}-01T00:00:00Z`));

export default async function CommitteePage() {
  await requireUser(AREAS.committee);
  const today = todayIST();
  const period = today.slice(0, 7);
  const lastPeriod = shiftPeriod(period, -1);
  const [now, last, trend] = await Promise.all([monthReport(db, period), monthReport(db, lastPeriod), onTimeTrend(db, 4)]);
  const overdue = now.ageing.slice(1).reduce((a, b) => a + b.amount, 0);
  const lastMonth = fmtMonth(lastPeriod);

  return (
    <div>
      <PageTitle
        title="How the township is doing"
        subtitle={`Live from the ledger and the help desk, as of ${fmtDate(today)}.`}
        action={
          <Link href={`/committee/report?month=${lastPeriod}`} className="whitespace-nowrap rounded-xl bg-surface px-3 py-2 text-sm font-medium ring-1 ring-line hover:bg-muted">
            Monthly report →
          </Link>
        }
      />

      <Card className="sm:p-6">
        <p className="text-sm text-ink-3">Collected in {fmtMonth(period)}</p>
        <p className="mt-1 text-5xl font-semibold tracking-tight text-ink sm:text-6xl">{compactINR(now.money.collected)}</p>
        <p className="mt-2 text-[15px] text-ink-2">
          of {compactINR(now.money.billedTotal)} billed this month ({now.collectionRate ?? 0}%). Bills are due on the 15th; most residents pay by the 10th.
        </p>
        <div className="mt-4 max-w-xl">
          <Meter value={now.collectionRate ?? 0} label="Share of this month's billing collected" />
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={`Bills paid on time, ${lastMonth}`}
          value={last.onTime == null ? "—" : `${Math.round(last.onTime)}%`}
          note={<StatusNote status={band(last.onTime, 90, 75)}>Target 90% (was 70% before the app)</StatusNote>}
        />
        <StatTile
          label="Bank payments that matched themselves"
          value={last.matching.autoRate == null ? "—" : `${Math.round(last.matching.autoRate)}%`}
          note={<StatusNote status={band(last.matching.autoRate, 80, 60)}>{now.matching.waiting} waiting for accounts now</StatusNote>}
          href="/accounts/review"
        />
        <StatTile
          label={`Complaints answered in time, ${lastMonth}`}
          value={last.complaints.withinTarget == null ? "—" : `${Math.round(last.complaints.withinTarget)}%`}
          note={<StatusNote status={band(last.complaints.withinTarget, 90, 75)}>Median first response {Math.round(last.complaints.responseMedianMin ?? 0)} min</StatusNote>}
        />
        <StatTile
          label={`Complaints reopened, ${lastMonth}`}
          value={last.complaints.reopenRate == null ? "—" : `${last.complaints.reopenRate}%`}
          note={<StatusNote status={band(last.complaints.reopenRate, 8, 15, true)}>Target under 8% (was 25%)</StatusNote>}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Bills paid in full by the 15th</h2>
          <p className="mb-5 text-sm text-ink-3">Share of each month&apos;s bills. The current month appears after its due date.</p>
          <PercentColumns
            target={90}
            targetLabel="Target 90%"
            data={trend.map((d) => ({ label: shortMonth(d.period), value: Math.round(d.rate), detail: `${fmtMonth(d.period)} bills paid by the 15th` }))}
          />
        </Card>
        <Card>
          <h2 className="font-semibold">Dues today, by age</h2>
          <p className="mb-5 text-sm text-ink-3">
            {compactINR(overdue)} overdue across {now.flatsOverdue.toLocaleString("en-IN")} flats; {now.defaulters.length} are more than 60 days behind. Another {compactINR(now.ageing[0].amount)} is billed but not yet due.
          </p>
          <AgeingBars rows={now.ageing.slice(1)} format={compactINR} />
        </Card>
      </div>

      <Section title={`Complaints in ${lastMonth}`}>
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="overflow-x-auto card">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Problems</th>
                  <th className="px-4 py-3 text-right font-medium">First response</th>
                  <th className="px-4 py-3 text-right font-medium">Fixed in</th>
                  <th className="px-4 py-3 text-right font-medium">Reopened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {last.complaints.byCategory.map((c) => (
                  <tr key={c.category}>
                    <td className="px-4 py-2.5 font-medium text-ink">{c.category}</td>
                    <td className="px-4 py-2.5 text-right">{c.count}</td>
                    <td className="px-4 py-2.5 text-right">{c.responseMin == null ? "—" : `${Math.round(c.responseMin)} min`}</td>
                    <td className="px-4 py-2.5 text-right">{c.resolutionH == null ? "—" : `${Math.round(c.resolutionH)} h`}</td>
                    <td className="px-4 py-2.5 text-right">{c.reopened || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3">
            <StatTile label="AI categories the help desk corrected" value={last.complaints.aiCorrected == null ? "—" : `${last.complaints.aiCorrected}%`} note={<span className="text-xs text-ink-2">Each correction is logged with what the AI said.</span>} />
            <StatTile label="Average rating from residents" value={last.complaints.rating == null ? "—" : `${last.complaints.rating} / 5`} note={<span className="text-xs text-ink-2">{last.complaints.reports} reports, grouped into {last.complaints.received} problems</span>} />
          </div>
        </div>
      </Section>
    </div>
  );
}
