import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageTitle, Section } from "@/components/ui";
import { db } from "@/db";
import { flatMembers, flats, ledger, payments, users } from "@/db/schema";
import { AREAS, requireUser } from "@/lib/auth";
import { AGEING_BUCKETS, withRunningBalance } from "@/lib/billing";
import { fmtDate } from "@/lib/dates";
import { flatPosition } from "@/lib/data";
import { rupees } from "@/lib/money";
import { maskPhone } from "@/lib/phone";
import { METHOD_LABEL, receiptNo } from "@/lib/payments";
import { ReverseForm } from "../../forms";

export const metadata: Metadata = { title: "Flat account" };

export default async function FlatAccountPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(AREAS.accounts);
  const flatId = decodeURIComponent((await params).id);
  const [flat] = await db.select().from(flats).where(eq(flats.id, flatId));
  if (!flat) notFound();
  const [pos, people, rows, pays] = await Promise.all([
    flatPosition(flatId),
    db.select({ name: users.name, phone: users.phone, relation: flatMembers.relation, isPrimary: flatMembers.isPrimary }).from(flatMembers).innerJoin(users, eq(users.id, flatMembers.userId)).where(and(eq(flatMembers.flatId, flatId), eq(flatMembers.active, true))),
    db.select().from(ledger).where(eq(ledger.flatId, flatId)).orderBy(ledger.date, ledger.id),
    db.select().from(payments).where(eq(payments.flatId, flatId)),
  ]);
  const payById = new Map(pays.map((p) => [p.id, p]));
  const history = withRunningBalance(rows);

  return (
    <div>
      <PageTitle
        title={`Flat ${flat.id}`}
        subtitle={`Tower ${flat.tower} · floor ${flat.floor} · ${flat.areaSqft.toLocaleString("en-IN")} sq ft · ${rupees(flat.areaSqft * 650)} a month`}
        back={{ href: "/accounts", label: "Accounts" }}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-3">Balance</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{rupees(pos.balance)}</p>
          {pos.daysOverdue > 0 ? <Badge tone="red" className="mt-2">{pos.daysOverdue} days overdue</Badge> : <Badge tone="emerald" className="mt-2">Nothing overdue</Badge>}
        </Card>
        <Card>
          <p className="mb-2 text-sm text-ink-3">Ageing</p>
          <dl className="space-y-1 text-sm">
            {AGEING_BUCKETS.map((b, i) => (
              <div key={b} className="flex justify-between">
                <dt className="text-ink-2">{b}</dt>
                <dd className={`tabular-nums ${i >= 3 && pos.ageing[i] ? "font-semibold text-danger" : ""}`}>{rupees(pos.ageing[i])}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <p className="mb-2 text-sm text-ink-3">Household</p>
          <ul className="space-y-1.5 text-sm">
            {people.map((p) => (
              <li key={p.phone} className="flex justify-between gap-2">
                <span>
                  {p.name} {p.isPrimary && <Badge tone="brand">pays</Badge>}
                </span>
                <span className="text-ink-3">
                  {p.relation.toLowerCase()} · {maskPhone(p.phone)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Section title="Ledger">
        <div className="overflow-x-auto card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Entry</th>
                <th className="px-4 py-3 text-right font-medium">Charge</th>
                <th className="px-4 py-3 text-right font-medium">Credit</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {history.map((r) => {
                const p = r.kind === "PAYMENT" && r.paymentId ? payById.get(r.paymentId) : undefined;
                return (
                  <tr key={r.id} className={p?.reversedAt ? "text-ink-3 line-through" : ""}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{fmtDate(r.date)}</td>
                    <td className="px-4 py-2.5">
                      {r.memo ?? r.kind.toLowerCase()}
                      {p && (
                        <Link href={`/receipts/${p.id}`} className="ml-2 text-xs font-medium text-accent-ink no-underline">
                          {receiptNo(p.id, p.paidOn)} · {METHOD_LABEL[p.method]}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.amount > 0 ? rupees(r.amount) : ""}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-success">{r.amount < 0 ? rupees(-r.amount) : ""}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-3">{rupees(r.balance)}</td>
                    <td className="px-4 py-2.5 text-right">{p && !p.reversedAt && p.source !== "GATEWAY" && <ReverseForm paymentId={p.id} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
