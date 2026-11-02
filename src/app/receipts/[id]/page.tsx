import { and, eq, lte, sum } from "drizzle-orm";
import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkButton, Logo, Notice } from "@/components/ui";
import { db } from "@/db";
import { flatMembers, ledger, payments, users } from "@/db/schema";
import { homeFor, requireUser } from "@/lib/auth";
import { TOWNSHIP } from "@/lib/config";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { isMember } from "@/lib/data";
import { getT } from "@/lib/lang";
import { inWords, rupees } from "@/lib/money";
import { METHOD_LABEL, receiptNo } from "@/lib/payments";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Receipt" };
const STAFF = ["ACCOUNTS", "MANAGER", "COMMITTEE", "HELPDESK"];

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [p] = await db.select().from(payments).where(eq(payments.id, id));
  if (!p || !(STAFF.includes(user.role) || (await isMember(user.id, p.flatId)))) notFound();
  const t = await getT();

  const [[after], [primary]] = await Promise.all([
    // Balance as of the payment date: everything posted to the flat up to and including that day.
    db.select({ total: sum(ledger.amount) }).from(ledger).where(and(eq(ledger.flatId, p.flatId), lte(ledger.date, p.paidOn))),
    db.select({ name: users.name }).from(flatMembers).innerJoin(users, eq(users.id, flatMembers.userId)).where(and(eq(flatMembers.flatId, p.flatId), eq(flatMembers.isPrimary, true))),
  ]);
  const balanceAfter = Number(after?.total ?? 0);
  const rows: [string, string][] = [
    ["Receipt no.", receiptNo(p.id, p.paidOn)],
    ["Date", fmtDate(p.paidOn)],
    ["Flat", p.flatId],
    ["Received from", p.payerName ?? primary?.name ?? "Resident"],
    ["Mode", p.source === "GATEWAY" ? `${METHOD_LABEL[p.method]} (paid in the app)` : METHOD_LABEL[p.method]],
    ["Reference", p.reference ?? "—"],
    ["Towards", `Maintenance and charges for flat ${p.flatId}`],
    ["Balance after this payment", balanceAfter > 0 ? `${rupees(balanceAfter)} due` : balanceAfter < 0 ? `${rupees(-balanceAfter)} in advance` : "Nil"],
  ];

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      {(await searchParams).new === "1" && (
        <Notice tone="emerald" icon={<CircleCheck className="size-4" aria-hidden />} className="no-print mb-4">
          {t("pay.done")}
        </Notice>
      )}
      <article className="card p-6 print:p-0 print:ring-0">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <Logo className="size-10" />
            <div>
              <p className="font-semibold leading-tight">{TOWNSHIP}</p>
              <p className="text-sm text-ink-3">Residents&apos; Federation, Pune</p>
            </div>
          </div>
          <p className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-2">Receipt</p>
        </header>
        <div className="py-5">
          <p className="text-sm text-ink-3">Amount received</p>
          <p className="text-4xl font-semibold tracking-tight tabular-nums">{rupees(p.amount)}</p>
          <p className="mt-1 text-sm text-ink-2">{inWords(p.amount)}</p>
        </div>
        <dl className="divide-y divide-line border-t border-line text-[15px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-right font-medium text-ink [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
        {p.reversedAt && (
          <Notice tone="red" className="mt-4">
            Reversed on {fmtDateTime(p.reversedAt)}: {p.reversalReason}
          </Notice>
        )}
        <p className="mt-5 text-xs text-ink-3">This is a computer-generated receipt and needs no signature.</p>
      </article>
      <div className="no-print mt-4 grid grid-cols-2 gap-2">
        <PrintButton />
        <LinkButton href={user.role === "RESIDENT" ? "/bills" : homeFor(user.role)} variant="secondary">
          Done
        </LinkButton>
      </div>
    </main>
  );
}
