import { ArrowUpRight } from "lucide-react";
import { AiNote } from "@/components/ai";
import type { Metadata } from "next";
import Link from "next/link";
import { AgeingBars, PercentColumns, StatTile, StatusNote, type Status } from "@/components/charts";
import { Card, LinkButton, PageTitle, Section } from "@/components/ui";
import { Gauge, ProgressBar } from "@/components/viz";
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
          <LinkButton href={`/committee/report?month=${lastPeriod}`} variant="secondary" size="sm">
            Monthly report <ArrowUpRight className="size-4" aria-hidden />
          </LinkButton>
        }
      />

      <section className="hero rounded-[32px] p-6 sm:p-8">
        <p className="text-sm font-medium text-white/65">Collected in {fmtMonth(period)}</p>
        <p className="mt-2 text-5xl font-semibold tracking-[-0.03em] sm:text-6xl">{compactINR(now.money.collected)}</p>
        <p className="mt-3 max-w-2xl text-[15px] text-white/75">
          of {compactINR(now.money.billedTotal)} billed this month ({now.collectionRate ?? 0}%). Bills are due on the 15th; most residents pay by the 10th.
        </p>
        <ProgressBar onDark value={(now.collectionRate ?? 0) / 100} label="Share of this month's billing collected" className="mt-5 max-w-xl" />
      </section>

      {/* The success measures, each against its target (the red tick). */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Gauge value={last.onTime == null ? null : Math.round(last.onTime)} target={90} label={`Paid on time, ${lastMonth}`} note={<StatusNote status={band(last.onTime, 90, 75)}>Target 90% (was 70% before the app)</StatusNote>} />
        </Card>
        <Link href="/accounts/review" className="card press block p-5 hover:bg-muted">
          <Gauge value={last.matching.autoRate == null ? null : Math.round(last.matching.autoRate)} target={80} label="Bank payments matched themselves" note={<StatusNote status={band(last.matching.autoRate, 80, 60)}>{now.matching.waiting} waiting for accounts now</StatusNote>} />
        </Link>
        <Card>
          <Gauge value={last.complaints.withinTarget == null ? null : Math.round(last.complaints.withinTarget)} target={90} label={`Answered in time, ${lastMonth}`} note={<StatusNote status={band(last.complaints.withinTarget, 90, 75)}>Median first response {Math.round(last.complaints.responseMedianMin ?? 0)} min</StatusNote>} />
        </Card>
        <Card>
          <Gauge value={last.complaints.reopenRate} target={8} max={30} lowerIsBetter label={`Reopened, ${lastMonth}`} note={<StatusNote status={band(last.complaints.reopenRate, 8, 15, true)}>Target under 8% (was 25%)</StatusNote>} />
        </Card>
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
            <AiNote title={last.complaints.aiCorrected == null ? "No AI decisions to check yet" : `The help desk corrected ${last.complaints.aiCorrected}% of AI categories`}>
              Each correction is logged with what the AI said, and the AI&apos;s unsure calls wait in &ldquo;Needs triage&rdquo;.
            </AiNote>
            <StatTile tone="peach" label="Average rating from residents" value={last.complaints.rating == null ? "—" : `${last.complaints.rating} / 5`} note={<span className="text-xs text-ink-2">{last.complaints.reports} reports, grouped into {last.complaints.received} problems</span>} />
          </div>
        </div>
      </Section>
    </div>
  );
}
