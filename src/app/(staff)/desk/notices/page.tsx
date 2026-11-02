import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Card, PageTitle, Section } from "@/components/ui";
import { db } from "@/db";
import { notices, users } from "@/db/schema";
import { AREAS, requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/dates";
import { NoticeForm } from "./notice-form";

export const metadata: Metadata = { title: "Notices" };

export default async function NoticesPage() {
  await requireUser(AREAS.desk);
  const list = await db.select({ n: notices, by: users.name }).from(notices).innerJoin(users, eq(users.id, notices.createdBy)).orderBy(desc(notices.createdAt)).limit(30);
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div>
        <PageTitle title="Notices" subtitle="Shown on residents' home screens: the whole township or one tower." />
        <Card>
          <NoticeForm />
        </Card>
      </div>
      <Section title="Posted" className="lg:mt-0">
        <ul className="space-y-2">
          {list.map(({ n, by }) => (
            <li key={n.id} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200/80">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{n.tower ? `Tower ${n.tower}` : "Everyone"}</p>
              <p className="mt-0.5 font-medium">{n.title}</p>
              <p className="mt-1 text-sm text-zinc-600">{n.body}</p>
              <p className="mt-2 text-xs text-zinc-400">
                {fmtDateTime(n.createdAt)} · {by}
              </p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
