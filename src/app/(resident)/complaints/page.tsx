import { and, desc, eq, inArray } from "drizzle-orm";
import { ChevronRight, Plus, Siren, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ComplaintStatus } from "@/components/badges";
import { cx, EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { complaints } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { relTime } from "@/lib/dates";
import { getLang } from "@/lib/lang";
import { translator, type Key } from "@/lib/i18n";

export const metadata: Metadata = { title: "Complaints" };
const OPEN = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED"] as const;

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { flat } = await requireResident();
  const lang = await getLang();
  const t = translator(lang);
  const closed = (await searchParams).tab === "closed";
  const rows = await db
    .select({ id: complaints.id, title: complaints.title, description: complaints.description, category: complaints.category, status: complaints.status, urgency: complaints.urgency, createdAt: complaints.createdAt })
    .from(complaints)
    .where(and(eq(complaints.flatId, flat.flatId), closed ? eq(complaints.status, "CLOSED") : inArray(complaints.status, [...OPEN])))
    .orderBy(desc(complaints.createdAt))
    .limit(50);

  return (
    <div>
      <PageTitle
        title={t("c.title")}
        action={
          <LinkButton href="/complaints/new" size="sm">
            <Plus className="size-4" aria-hidden /> {t("c.new")}
          </LinkButton>
        }
      />
      <div className="mb-4 inline-flex rounded-xl bg-zinc-100 p-1" role="tablist">
        {[
          { href: "/complaints", label: t("c.open"), on: !closed },
          { href: "/complaints?tab=closed", label: t("c.closed"), on: closed },
        ].map((tab) => (
          <Link key={tab.href} href={tab.href} role="tab" aria-selected={tab.on} className={cx("rounded-lg px-4 py-2 text-sm font-medium", tab.on ? "bg-white shadow-sm" : "text-zinc-600")}>
            {tab.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<Wrench className="size-5" aria-hidden />} title={t("c.empty")}>
          {!closed && (
            <Link href="/complaints/new" className="font-medium text-teal-800">
              {t("home.raise")} →
            </Link>
          )}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/complaints/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-zinc-200/80 hover:bg-zinc-50">
                {c.urgency === "EMERGENCY" && <Siren className="size-5 shrink-0 text-red-600" aria-label="Emergency" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-zinc-900">{c.title ?? c.description}</p>
                  <p className="text-xs text-zinc-500">
                    #{c.id} · {t(`cat.${c.category}` as Key)} · {relTime(c.createdAt, lang)}
                  </p>
                </div>
                <ComplaintStatus status={c.status} t={t} />
                <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
