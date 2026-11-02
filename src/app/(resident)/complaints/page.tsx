import { and, desc, eq, inArray } from "drizzle-orm";
import { Plus, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ComplaintRow } from "@/components/complaint-row";
import { cx, EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { complaints } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { translator } from "@/lib/i18n";

export const metadata: Metadata = { title: "Complaints" };
const OPEN = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED"] as const;

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { flat } = await requireResident();
  const lang = await getLang();
  const t = translator(lang);
  const closed = (await searchParams).tab === "closed";
  const rows = await db
    .select({ id: complaints.id, description: complaints.description, category: complaints.category, status: complaints.status, urgency: complaints.urgency, createdAt: complaints.createdAt })
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
      <div className="mb-5 inline-flex rounded-full bg-surface p-1 shadow-[0_1px_2px_rgb(18_18_18/0.05),0_10px_24px_-14px_rgb(18_18_18/0.22)] dark:ring-1 dark:ring-line" role="tablist">
        {[
          { href: "/complaints", label: t("c.open"), on: !closed },
          { href: "/complaints?tab=closed", label: t("c.closed"), on: closed },
        ].map((tab) => (
          <Link key={tab.href} href={tab.href} role="tab" aria-selected={tab.on} className={cx("press rounded-full px-5 py-2.5 text-sm font-semibold", tab.on ? "bg-cta text-cta-ink" : "text-ink-3 hover:text-ink")}>
            {tab.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<Wrench className="size-5" aria-hidden />} title={t("c.empty")}>
          {!closed && (
            <Link href="/complaints/new" className="font-medium text-accent-ink">
              {t("home.raise")} →
            </Link>
          )}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id}>
              <ComplaintRow c={c} t={t} lang={lang} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
