import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt, ne, sql, type SQL } from "drizzle-orm";
import { Bot, Link2, Siren } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, cx, EmptyState, PageTitle, type Tone } from "@/components/ui";
import { db } from "@/db";
import { complaints, users } from "@/db/schema";
import { AREAS, requireUser } from "@/lib/auth";
import { relTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Complaints" };

const VIEWS = {
  active: "Active",
  emergency: "Emergencies",
  triage: "Needs triage",
  overdue: "Response overdue",
  resolved: "Waiting for resident",
  closed: "Closed",
} as const;
type View = keyof typeof VIEWS;

const STATUS: Record<string, [string, Tone]> = { OPEN: ["Unassigned", "sky"], ASSIGNED: ["Assigned", "sky"], IN_PROGRESS: ["In progress", "amber"], RESOLVED: ["Fixed, awaiting resident", "violet"], CLOSED: ["Closed", "zinc"] };
const BAR: Record<string, string> = { EMERGENCY: "bg-red-500", HIGH: "bg-amber-500", MEDIUM: "bg-sky-400", LOW: "bg-zinc-300" };

export default async function DeskPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireUser(AREAS.desk);
  const v = (await searchParams).view;
  const view: View = v && v in VIEWS ? (v as View) : "active";
  const now = new Date();
  const root = isNull(complaints.parentId);
  const waiting = inArray(complaints.status, ["OPEN", "ASSIGNED"]);
  const where: Record<View, SQL | undefined> = {
    active: and(root, inArray(complaints.status, ["OPEN", "ASSIGNED", "IN_PROGRESS"])),
    emergency: and(root, eq(complaints.safety, true), ne(complaints.status, "CLOSED")),
    triage: and(root, eq(complaints.needsTriage, true), waiting),
    overdue: and(root, isNull(complaints.firstResponseAt), waiting, lt(complaints.responseDueAt, now)),
    resolved: and(root, eq(complaints.status, "RESOLVED")),
    closed: and(root, eq(complaints.status, "CLOSED")),
  };

  const kids = db.select({ parentId: complaints.parentId, n: count().as("n") }).from(complaints).where(isNotNull(complaints.parentId)).groupBy(complaints.parentId).as("kids");
  const [[counts], rows] = await Promise.all([
    db
      .select(Object.fromEntries((Object.keys(VIEWS) as View[]).map((k) => [k, sql<number>`(count(*) filter (where ${where[k]}))::int`])) as Record<View, SQL<number>>)
      .from(complaints),
    db
      .select({ c: complaints, tech: users.name, linked: kids.n })
      .from(complaints)
      .leftJoin(users, eq(users.id, complaints.assignedTo))
      .leftJoin(kids, eq(kids.parentId, complaints.id))
      .where(where[view])
      // Emergencies, then complaints nobody has answered yet (soonest deadline first), then work in progress.
      .orderBy(...(view === "closed" ? [desc(complaints.closedAt)] : [desc(complaints.safety), sql`${complaints.firstResponseAt} is null desc`, asc(complaints.responseDueAt)]))
      .limit(100),
  ]);

  return (
    <div>
      <PageTitle title="Complaints" subtitle="Classified by AI, checked by rules. Safety words always go to the duty manager. Fix a wrong category in one tap." />
      <nav className="-mx-1 mb-4 flex gap-1 overflow-x-auto pb-1" aria-label="Views">
        {(Object.keys(VIEWS) as View[]).map((k) => (
          <Link
            key={k}
            href={k === "active" ? "/desk" : `/desk?view=${k}`}
            aria-current={k === view ? "page" : undefined}
            className={cx("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ring-1", k === view ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50")}
          >
            {VIEWS[k]}
            <span className={cx("tabular-nums", k === view ? "text-zinc-300" : (k === "emergency" || k === "overdue") && Number(counts[k]) > 0 ? "text-red-600" : "text-zinc-400")}>{Number(counts[k])}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState title={`Nothing in “${VIEWS[view]}”.`} />
      ) : (
        <ul className="space-y-2">
          {rows.map(({ c, tech, linked }) => {
            const clock = !c.firstResponseAt && (c.status === "OPEN" || c.status === "ASSIGNED");
            const late = clock && c.responseDueAt < now;
            return (
              <li key={c.id}>
                <Link href={`/desk/complaints/${c.id}`} className="flex overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200/80 hover:ring-zinc-400">
                  <span className={cx("w-1.5 shrink-0", BAR[c.urgency])} aria-hidden />
                  <div className="grid min-w-0 flex-1 gap-2 p-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[15px] font-medium text-zinc-900">
                        {c.safety && <Siren className="size-4 shrink-0 text-red-600" aria-label="Safety escalation" />}
                        <span className="truncate">{c.title ?? c.description}</span>
                      </p>
                      <p className="mt-0.5 truncate text-sm text-zinc-500">
                        #{c.id} · {c.flatId} · {relTime(c.createdAt)}
                        {c.title && ` · “${c.description}”`}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone="zinc">{c.category}</Badge>
                        {c.classifiedBy === "AI" ? (
                          <Badge tone={c.needsTriage ? "amber" : "teal"}>
                            <Bot className="size-3" aria-hidden /> AI {c.aiConfidence}%
                          </Badge>
                        ) : (
                          <Badge tone="zinc">{c.classifiedBy === "STAFF" ? "Set by desk" : "Rules"}</Badge>
                        )}
                        {Number(linked ?? 0) > 0 && (
                          <Badge tone="violet">
                            <Link2 className="size-3" aria-hidden /> +{Number(linked)} same problem
                          </Badge>
                        )}
                        {c.reopenCount > 0 && <Badge tone="red">Reopened</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      <Badge tone={STATUS[c.status][1]}>{STATUS[c.status][0]}</Badge>
                      <span className="text-xs text-zinc-500">{tech ?? "No technician"}</span>
                      {clock && <span className={cx("text-xs font-medium", late ? "text-red-700" : "text-zinc-500")}>{late ? `Response overdue ${relTime(c.responseDueAt).replace(" ago", "")}` : `Respond ${relTime(c.responseDueAt)}`}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
