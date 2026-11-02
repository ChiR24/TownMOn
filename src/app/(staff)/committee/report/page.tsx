import { ArrowLeft, CircleCheck, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/app/receipts/[id]/print-button";
import { Logo } from "@/components/brand";
import { Button, Select } from "@/components/ui";
import { db } from "@/db";
import { AREAS, requireUser } from "@/lib/auth";
import { TOWNSHIP } from "@/lib/config";
import { fmtDate, fmtDateTime, fmtMonth, shiftPeriod, todayIST } from "@/lib/dates";
import { monthReport } from "@/lib/metrics";
import { rupees } from "@/lib/money";

export const metadata: Metadata = { title: "Monthly report" };

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mb-3 mt-8 text-base font-semibold text-ink print:mt-6">{children}</h2>;

// On a phone a wide table scrolls sideways inside the report instead of pushing the whole page wider.
function Table({ head, rows, align }: { head: string[]; rows: (string | number)[][]; align?: ("l" | "r")[] }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
            {head.map((h, i) => (
              <th key={h} className={`py-2 pr-3 font-medium ${align?.[i] === "r" ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`py-2 pr-3 ${align?.[j] === "r" ? "text-right" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireUser(AREAS.committee);
  const today = todayIST();
  const options = Array.from({ length: 6 }, (_, i) => shiftPeriod(today.slice(0, 7), -i));
  const asked = (await searchParams).month;
  const period = asked && options.includes(asked) ? asked : options[1];
  const r = await monthReport(db, period);
  const m = r.money;
  const ok = m.difference === 0;

  return (
    <div className="max-w-3xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/committee" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Dashboard
        </Link>
        <form className="flex flex-wrap items-center gap-2">
          <label htmlFor="month" className="text-sm font-medium text-ink-2">
            Month
          </label>
          <Select compact id="month" name="month" defaultValue={period}>
            {options.map((p) => (
              <option key={p} value={p}>
                {fmtMonth(p)}
                {p === options[0] ? " (so far)" : ""}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary" size="sm">
            Show
          </Button>
          <PrintButton size="sm" />
        </form>
      </div>

      <article className="card p-6 sm:p-8 print:p-0 print:ring-0">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <Logo className="size-10" />
            <div>
              <p className="font-semibold">{TOWNSHIP} Residents&apos; Federation</p>
              <p className="text-sm text-ink-3">Maintenance and help desk report</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{fmtMonth(period)}</p>
            <p className="text-xs text-ink-3">Position as of {fmtDate(r.asOf)}</p>
          </div>
        </header>

        <H>1. Money: does it add up?</H>
        <Table
          head={["", "Amount"]}
          align={["l", "r"]}
          rows={[
            [`Outstanding on 1 ${fmtMonth(period)}`, rupees(m.opening)],
            ["+ Maintenance billed", rupees(m.billed.maintenance)],
            ["+ Interest on overdue dues", rupees(m.billed.interest)],
            ["+ Amenity bookings", rupees(m.billed.amenity)],
            ...(m.billed.adjustments ? [["+ Adjustments", rupees(m.billed.adjustments)]] : []),
            ...(m.reversed ? [["+ Payments reversed (posted to the wrong flat)", rupees(m.reversed)]] : []),
            ["− Collected", rupees(m.collected)],
            [`Outstanding at the end of the month`, rupees(m.closing)],
          ]}
        />
        <p className={`mt-3 flex items-center gap-2 text-sm ${ok ? "text-ink-2" : "font-medium text-danger"}`}>
          {ok ? <CircleCheck className="size-4 text-success" aria-hidden /> : <TriangleAlert className="size-4 text-danger" aria-hidden />}
          {ok ? "Reconciles to the paisa. Every figure comes from the same ledger, which is never edited: corrections are separate, dated lines." : `Does not reconcile: difference ${rupees(m.difference)}. Escalate to accounts.`}
        </p>

        <H>2. Collections by mode</H>
        <Table head={["Mode", "Payments", "Amount"]} align={["l", "r", "r"]} rows={r.byMethod.map((x) => [x.method, x.count.toLocaleString("en-IN"), rupees(x.amount)])} />
        <p className="mt-3 text-sm text-ink-2">
          Collected {rupees(m.collected)} against {rupees(m.billedTotal)} billed ({r.collectionRate ?? 0}%).{" "}
          {r.onTime == null ? "This month's bills are not due yet." : `${r.onTime}% of this month's bills were paid in full by the 15th.`}
        </p>

        <H>3. Bank statement matching</H>
        <Table
          head={["Resident credits", "Posted automatically", "Posted by accounts", "Still waiting", "Gateway payouts reconciled"]}
          align={["r", "r", "r", "r", "r"]}
          rows={[[r.matching.credits, `${r.matching.auto} (${r.matching.autoRate ?? 0}%)`, r.matching.manual, r.matching.waiting, r.matching.payouts]]}
        />

        <H>4. Dues by age, {fmtDate(r.asOf)}</H>
        <Table head={["Age", "Flats", "Amount"]} align={["l", "r", "r"]} rows={r.ageing.map((a) => [a.label, a.flats.toLocaleString("en-IN"), rupees(a.amount)])} />
        {r.defaulters.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-sm font-medium">More than 60 days behind ({r.defaulters.length} flats)</p>
            <Table head={["Flat", "Days overdue", "Balance"]} align={["l", "r", "r"]} rows={r.defaulters.slice(0, 25).map((d) => [d.flatId, d.days, rupees(d.balance)])} />
            {r.defaulters.length > 25 && <p className="mt-2 text-xs text-ink-3">and {r.defaulters.length - 25} more, listed in the accounts console.</p>}
          </>
        )}

        <H>5. Complaints</H>
        <Table
          head={["Problems", "Reports", "Answered in time", "Median first response", "Median time to fix", "Reopened", "Rating", "AI corrected"]}
          align={["r", "r", "r", "r", "r", "r", "r", "r"]}
          rows={[
            [
              r.complaints.received,
              r.complaints.reports,
              r.complaints.withinTarget == null ? "—" : `${Math.round(r.complaints.withinTarget)}%`,
              r.complaints.responseMedianMin == null ? "—" : `${Math.round(r.complaints.responseMedianMin)} min`,
              r.complaints.resolutionMedianH == null ? "—" : `${Math.round(r.complaints.resolutionMedianH)} h`,
              r.complaints.reopenRate == null ? "—" : `${r.complaints.reopenRate}%`,
              r.complaints.rating == null ? "—" : `${r.complaints.rating}/5`,
              r.complaints.aiCorrected == null ? "—" : `${r.complaints.aiCorrected}%`,
            ],
          ]}
        />
        <div className="mt-4">
          <Table
            head={["Category", "Problems", "First response", "Fixed in", "Reopened"]}
            align={["l", "r", "r", "r", "r"]}
            rows={r.complaints.byCategory.map((c) => [c.category, c.count, c.responseMin == null ? "—" : `${Math.round(c.responseMin)} min`, c.resolutionH == null ? "—" : `${Math.round(c.resolutionH)} h`, c.reopened || "—"])}
          />
        </div>

        <footer className="mt-8 border-t border-line pt-3 text-xs text-ink-3">
          Generated {fmtDateTime(new Date())}. Linked reports of the same problem count once. Response targets: emergency 15 min, high 1 h, medium 4 h, low 24 h.
        </footer>
      </article>
    </div>
  );
}
