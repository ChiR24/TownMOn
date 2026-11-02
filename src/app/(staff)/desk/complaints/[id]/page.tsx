import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { Link2, Phone, Siren } from "lucide-react";
import { AiNote } from "@/components/ai";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, cx, inputCls, Notice, PageTitle, Select } from "@/components/ui";
import { db } from "@/db";
import { complaintEvents, complaints, users } from "@/db/schema";
import { AREAS, requireUser } from "@/lib/auth";
import { CATEGORIES, teamFor, URGENCIES, URGENCY_LABEL, type Category } from "@/lib/complaints";
import { fmtDateTime, relTime } from "@/lib/dates";
import { assign, setCategory, setUrgency, unlink, update } from "../../actions";

export const metadata: Metadata = { title: "Complaint" };

export default async function DeskComplaintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(AREAS.desk);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const resident = alias(users, "resident");
  const tech = alias(users, "tech");
  const [row] = await db
    .select({ c: complaints, residentName: resident.name, residentPhone: resident.phone, techName: tech.name })
    .from(complaints)
    .innerJoin(resident, eq(resident.id, complaints.raisedBy))
    .leftJoin(tech, eq(tech.id, complaints.assignedTo))
    .where(eq(complaints.id, id));
  if (!row) notFound();
  const c = row.c;
  const [events, children, techs] = await Promise.all([
    db.select({ e: complaintEvents, actor: users.name }).from(complaintEvents).leftJoin(users, eq(users.id, complaintEvents.actorId)).where(eq(complaintEvents.complaintId, id)).orderBy(asc(complaintEvents.createdAt), asc(complaintEvents.id)),
    db.select({ id: complaints.id, flatId: complaints.flatId, description: complaints.description, createdAt: complaints.createdAt }).from(complaints).where(eq(complaints.parentId, id)).orderBy(asc(complaints.createdAt)),
    db.select({ id: users.id, name: users.name, team: users.team }).from(users).where(eq(users.role, "TECHNICIAN")).orderBy(users.team, users.name),
  ]);
  const team = teamFor(c.category as Category);
  const open = c.status !== "CLOSED" && c.status !== "RESOLVED";

  return (
    <div>
      <PageTitle title={c.title ?? `Complaint #${c.id}`} subtitle={`#${c.id} · ${c.flatId} · raised ${relTime(c.createdAt)} by ${row.residentName}`} back={{ href: "/desk", label: "Complaints" }} />
      {c.safety && c.status !== "CLOSED" && (
        <Notice tone="red" icon={<Siren className="size-4" aria-hidden />} className="mb-4">
          Safety escalation. The duty manager was alerted. Respond within 15 minutes; call 112 if anyone is in danger.
        </Notice>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="space-y-3">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{c.description}</p>
            {c.photoId && (
              // eslint-disable-next-line @next/next/no-img-element -- private, access-checked photo route
              <img src={`/api/photos/${c.photoId}`} alt="Photo from the resident" className="max-h-80 rounded-xl ring-1 ring-line" />
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <a href={`tel:+91${row.residentPhone}`} className="press inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 font-semibold text-ink-2 hover:bg-ink/10">
                <Phone className="size-3.5" aria-hidden /> Call {row.residentName.split(" ")[0]}
              </a>
            </div>
            {c.classifiedBy === "AI" && (
              <AiNote title={c.needsTriage ? `AI is only ${c.aiConfidence}% sure. Please check the category.` : `AI sorted this as ${c.category}, ${c.urgency.toLowerCase()} urgency, ${c.aiConfidence}% sure.`}>
                One tap below changes it; every correction is counted for the committee.
              </AiNote>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {c.reopenCount > 0 && <Badge tone="red">Reopened {c.reopenCount}×</Badge>}
              {c.rating && <Badge tone="amber">{"★".repeat(c.rating)} {c.ratingComment ? `“${c.ratingComment}”` : ""}</Badge>}
            </div>
          </Card>

          {c.parentId && (
            <Card className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm">
                <Link2 className="size-4" aria-hidden /> Linked to{" "}
                <Link href={`/desk/complaints/${c.parentId}`} className="font-medium text-accent-ink">
                  #{c.parentId}
                </Link>
                . Its updates reach this resident.
              </p>
              <form action={unlink.bind(null, c.id)}>
                <SubmitButton size="sm" variant="ghost">
                  Not the same problem
                </SubmitButton>
              </form>
            </Card>
          )}
          {children.length > 0 && (
            <Card>
              <p className="mb-2 text-sm font-semibold">{children.length} more flats reported the same problem</p>
              <ul className="divide-y divide-line text-sm">
                {children.map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">
                      <Link href={`/desk/complaints/${k.id}`} className="font-medium text-accent-ink">
                        #{k.id}
                      </Link>{" "}
                      {k.flatId} · “{k.description}” · {relTime(k.createdAt)}
                    </span>
                    <form action={unlink.bind(null, k.id)}>
                      <SubmitButton size="sm" variant="ghost" className="text-xs" aria-label={`Unlink #${k.id}: a different problem`}>
                        Unlink
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-3">Updates you post here go to all of them. None of them is closed for being a duplicate.</p>
            </Card>
          )}

          <Card>
            <p className="mb-3 text-sm font-semibold">Timeline</p>
            <ol className="relative space-y-3 border-l border-line pl-5 text-sm">
              {events.map(({ e, actor }) => (
                <li key={e.id} className="relative">
                  <span className={cx("absolute -left-[25px] top-1.5 size-2.5 rounded-full", e.kind === "ESCALATED" ? "bg-red-500" : e.kind === "CLASSIFIED" ? "bg-violet-500" : "bg-accent-ink")} />
                  <p className="text-ink">{e.note ?? (e.kind === "CREATED" ? "Complaint raised" : e.kind.toLowerCase())}</p>
                  <p className="text-xs text-ink-3">
                    {fmtDateTime(e.createdAt)} · {actor ?? "system"}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          {open && (
            <Card>
              <form action={update.bind(null, c.id)} className="space-y-2">
                <label htmlFor="note" className="text-sm font-semibold">
                  Update the resident{children.length > 0 && "s"}
                </label>
                <textarea id="note" name="note" rows={3} maxLength={500} placeholder="e.g. Plumber will come at 4 pm" className={`${inputCls} text-sm`} />
                <div className="grid grid-cols-3 gap-2">
                  <SubmitButton name="intent" value="note" size="sm" variant="secondary" className="whitespace-nowrap !px-2">
                    Note
                  </SubmitButton>
                  <SubmitButton name="intent" value="start" size="sm" variant="secondary" disabled={c.status === "IN_PROGRESS"} className="whitespace-nowrap !px-2">
                    Start work
                  </SubmitButton>
                  <SubmitButton name="intent" value="resolve" size="sm" className="whitespace-nowrap !px-2">
                    Fixed
                  </SubmitButton>
                </div>
                <p className="text-xs text-ink-3">“Fixed” asks the resident to confirm and rate. Only they close it.</p>
              </form>
            </Card>
          )}

          <Card>
            <p className="mb-2 text-sm font-semibold">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <form key={cat} action={setCategory.bind(null, c.id, cat)}>
                  <button className={cx("rounded-full px-2.5 py-1 text-xs font-medium ring-1", cat === c.category ? "bg-cta text-cta-ink ring-cta" : "bg-surface text-ink-2 ring-line hover:bg-muted")} aria-pressed={cat === c.category}>
                    {cat}
                  </button>
                </form>
              ))}
            </div>
          </Card>

          <Card className="space-y-3">
            {/* Each dropdown keeps room for a technician's full name; its button goes under it where both don't fit. */}
            <form action={setUrgency.bind(null, c.id)} className="flex flex-wrap items-end gap-2">
              <label className="min-w-56 flex-1 text-sm font-semibold">
                Urgency
                <Select compact key={c.urgency} name="urgency" defaultValue={c.urgency} wrap="mt-1.5" className="font-normal">
                  {URGENCIES.map((u) => (
                    <option key={u} value={u}>
                      {URGENCY_LABEL[u]}
                    </option>
                  ))}
                </Select>
              </label>
              <SubmitButton size="sm" variant="secondary">
                Save
              </SubmitButton>
            </form>
            {open && (
              <form action={assign.bind(null, c.id)} className="flex flex-wrap items-end gap-2">
                <label className="min-w-56 flex-1 text-sm font-semibold">
                  Technician
                  <Select compact key={c.assignedTo ?? "none"} name="techId" defaultValue={c.assignedTo ?? ""} wrap="mt-1.5" className="font-normal">
                    <option value="" disabled>
                      Choose…
                    </option>
                    {techs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.team === team ? " ✓" : ` (${t.team})`}
                      </option>
                    ))}
                  </Select>
                </label>
                <SubmitButton size="sm" variant="secondary">
                  Assign
                </SubmitButton>
              </form>
            )}
            <p className="text-xs text-ink-3">
              Response due {fmtDateTime(c.responseDueAt)}
              {c.firstResponseAt ? ` · answered ${relTime(c.firstResponseAt)}` : ""}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
