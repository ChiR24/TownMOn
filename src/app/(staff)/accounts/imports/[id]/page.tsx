import { asc, eq } from "drizzle-orm";
import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Notice, PageTitle, type Tone } from "@/components/ui";
import { db } from "@/db";
import { bankImports, bankTxns, users } from "@/db/schema";
import { AREAS, requireUser } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { rupees } from "@/lib/money";

export const metadata: Metadata = { title: "Statement import" };

const STATUS: Record<string, [string, Tone]> = {
  AUTO_MATCHED: ["Posted itself", "emerald"],
  MATCHED: ["Posted by accounts", "brand"],
  NEEDS_REVIEW: ["Waiting for review", "amber"],
  SETTLEMENT: ["Gateway payout", "sky"],
  IGNORED: ["Not a resident payment", "zinc"],
};

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(AREAS.accounts);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [imp] = await db.select({ i: bankImports, by: users.name }).from(bankImports).innerJoin(users, eq(users.id, bankImports.uploadedBy)).where(eq(bankImports.id, id));
  if (!imp) notFound();
  const rows = await db.select().from(bankTxns).where(eq(bankTxns.importId, id)).orderBy(asc(bankTxns.id));
  const { i } = imp;
  const settled = rows.filter((r) => r.status === "SETTLEMENT").length;
  const resident = i.autoMatched + i.needsReview;

  return (
    <div>
      <PageTitle title={i.fileName} subtitle={`Imported ${fmtDateTime(i.createdAt)} by ${imp.by}`} back={{ href: "/accounts", label: "Accounts" }} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Credits read", i.credits],
          ["Posted itself", i.autoMatched],
          ["Sent to review", i.needsReview],
          ["Gateway payouts", settled],
          ["Already imported", i.duplicates],
        ].map(([label, value]) => (
          <Card key={label as string} className="p-3 sm:p-4">
            <p className="text-xs text-ink-3">{label}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
          </Card>
        ))}
      </div>
      {resident > 0 && (
        <p className="mt-3 text-sm text-ink-2">
          {Math.round((100 * i.autoMatched) / resident)}% of resident payments in this file were posted without anyone touching them.{" "}
          {i.needsReview > 0 && (
            <Link href="/accounts/review" className="font-medium text-accent-ink">
              Review the rest →
            </Link>
          )}
        </p>
      )}

      {rows.length === 0 && (
        <Notice tone="emerald" icon={<CircleCheck className="size-4" aria-hidden />} className="mt-6">
          Every line in this file was imported before, so nothing was posted twice.
        </Notice>
      )}

      <div className={rows.length ? "mt-6 overflow-x-auto card" : "hidden"}>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Narration</th>
              <th className="px-4 py-3 font-medium">Outcome</th>
              <th className="px-4 py-3 font-medium">Why</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{fmtDate(r.txnDate)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{rupees(r.amount)}</td>
                <td className="max-w-xs break-all px-4 py-3 font-mono text-xs text-ink-2">{r.narration}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge>
                  {r.flatId && (
                    <Link href={`/accounts/flats/${r.flatId}`} className="mt-1 block text-xs font-medium text-accent-ink">
                      {r.flatId}
                    </Link>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink-2">{r.reasons.join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
