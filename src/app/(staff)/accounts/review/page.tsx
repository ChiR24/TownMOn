import { asc, eq } from "drizzle-orm";
import { CircleCheck, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, EmptyState, Notice, PageTitle, Select } from "@/components/ui";
import { db } from "@/db";
import { bankTxns } from "@/db/schema";
import { AREAS, requireUser } from "@/lib/auth";
import { readNarration } from "@/lib/bank";
import { fmtDate } from "@/lib/dates";
import { rupees } from "@/lib/money";
import { ignoreEntry, postToFlat } from "../actions";
import { OtherFlatForm } from "../forms";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewPage() {
  await requireUser(AREAS.accounts);
  const queue = await db.select().from(bankTxns).where(eq(bankTxns.status, "NEEDS_REVIEW")).orderBy(asc(bankTxns.txnDate), asc(bankTxns.id)).limit(50);

  return (
    <div>
      <PageTitle
        title="Review queue"
        subtitle="Credits the system wouldn't post on its own. Pick the flat, or mark it as not a resident payment. Your choice teaches it the payer's UPI ID."
        action={<Badge tone={queue.length ? "amber" : "emerald"}>{queue.length} waiting</Badge>}
      />
      {queue.length === 0 ? (
        <EmptyState icon={<CircleCheck className="size-5" aria-hidden />} title="Nothing to review">
          Every credit from the imported statements is posted or explained. <Link href="/accounts" className="font-medium text-accent-ink">Import another statement</Link>
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {queue.map((t) => {
            const n = readNarration(t.narration, t.refNo ?? "");
            return (
              <li key={t.id}>
                <Card className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold tracking-tight tabular-nums">{rupees(t.amount)}</p>
                      <p className="text-sm text-ink-3">
                        {fmtDate(t.txnDate)} · {t.method ?? "Other"}
                        {t.payerName && ` · from ${t.payerName}`}
                        {t.payerVpa && ` · ${t.payerVpa}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {n.flatHints.map((h) => (
                        <Badge key={h} tone="sky">
                          Note says {h}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <p className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs text-ink-2">{t.narration}</p>
                  <Notice tone="amber" icon={<TriangleAlert className="size-4" aria-hidden />}>
                    {t.reasons.join(" ")}
                  </Notice>

                  {t.suggestions.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Likely flats</p>
                      <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
                        {t.suggestions.slice(0, 3).map((s) => (
                          <li key={s.flatId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-[15px] font-medium">
                                <Link href={`/accounts/flats/${s.flatId}`} className="hover:underline">
                                  {s.flatId}
                                </Link>{" "}
                                <span className="text-xs font-normal text-ink-3">score {s.score}</span>
                              </p>
                              <p className="text-xs text-ink-2">{s.reasons.join(" · ")}</p>
                            </div>
                            <form action={postToFlat.bind(null, t.id, s.flatId)}>
                              <SubmitButton size="sm">Post to {s.flatId}</SubmitButton>
                            </form>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                    <OtherFlatForm txnId={t.id} />
                    {/* Where the reason and the button don't both fit (a phone), the button goes under it, not over it. */}
                    <form action={ignoreEntry.bind(null, t.id)} className="flex flex-wrap gap-2">
                      <label className="sr-only" htmlFor={`reason-${t.id}`}>
                        Reason
                      </label>
                      <Select compact id={`reason-${t.id}`} name="reason" wrap="min-w-40 flex-1">
                        <option>Bank interest</option>
                        <option>Refund or reversal by the bank</option>
                        <option>Vendor or other income</option>
                        <option>Duplicate of an entry already posted</option>
                      </Select>
                      <SubmitButton size="sm" variant="secondary" className="whitespace-nowrap">
                        Not a resident payment
                      </SubmitButton>
                    </form>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
