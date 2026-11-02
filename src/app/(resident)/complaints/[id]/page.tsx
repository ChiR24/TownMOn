import { asc, eq } from "drizzle-orm";
import { CircleCheck, Clock, Link2, Phone, Siren } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComplaintStatus } from "@/components/badges";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Notice, PageTitle, Section } from "@/components/ui";
import { db } from "@/db";
import { complaintEvents, complaints, users } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { fmtDateTime, fmtTime, relTime } from "@/lib/dates";
import { isMember } from "@/lib/data";
import { getLang } from "@/lib/lang";
import { translator, type Key } from "@/lib/i18n";
import { reopen } from "../actions";
import { RateForm } from "./rate-form";

export const metadata: Metadata = { title: "Complaint" };

export default async function ComplaintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { user } = await requireResident();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [c] = await db.select({ c: complaints, tech: users.name }).from(complaints).leftJoin(users, eq(users.id, complaints.assignedTo)).where(eq(complaints.id, id));
  if (!c || !(await isMember(user.id, c.c.flatId))) notFound();
  const lang = await getLang();
  const t = translator(lang);
  const events = await db.select().from(complaintEvents).where(eq(complaintEvents.complaintId, id)).orderBy(asc(complaintEvents.createdAt), asc(complaintEvents.id));
  const x = c.c;
  const isNew = (await searchParams).new === "1";
  const waiting = !x.firstResponseAt && x.status !== "RESOLVED" && x.status !== "CLOSED";
  const late = waiting && x.responseDueAt < new Date();

  return (
    <div>
      <PageTitle title={t(`cat.${x.category}` as Key)} subtitle={`#${x.id} · ${fmtDateTime(x.createdAt, lang)}`} back={{ href: "/complaints", label: t("common.back") }} action={<ComplaintStatus status={x.status} t={t} />} />

      {isNew && (
        <Notice tone="emerald" icon={<CircleCheck className="size-4" aria-hidden />} className="mb-4">
          {t("c.sent")}
        </Notice>
      )}
      {x.safety && x.status !== "CLOSED" && (
        <Notice tone="red" icon={<Siren className="size-4" aria-hidden />} className="mb-4">
          <p className="font-medium">{t("c.emergency")}</p>
          <p>{t("c.call112")}</p>
        </Notice>
      )}

      <Card className="space-y-3">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{x.description}</p>
        {x.photoId && (
          // eslint-disable-next-line @next/next/no-img-element -- private, access-checked photo route
          <img src={`/api/photos/${x.photoId}`} alt="" className="max-h-64 rounded-xl object-cover ring-1 ring-line" />
        )}
        <div className="flex flex-wrap gap-2 text-sm text-ink-2">
          {c.tech && <Badge tone="teal">{t("c.with", { name: c.tech })}</Badge>}
          {waiting && (
            <Badge tone={late ? "red" : "zinc"}>
              <Clock className="size-3" aria-hidden /> {t("c.respondBy", { time: fmtTime(x.responseDueAt, lang) })}
            </Badge>
          )}
        </div>
        {late && <p className="text-sm text-red-700 dark:text-red-300">{t("c.late")}</p>}
        {x.parentId && (
          <p className="flex items-start gap-2 text-sm text-ink-2">
            <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("c.linked")}
          </p>
        )}
      </Card>

      {x.status === "RESOLVED" && (
        <Card className="mt-4 space-y-4 ring-violet-200 dark:ring-violet-400/30">
          <p className="text-[15px] font-semibold text-ink">{t("c.status.RESOLVED")}</p>
          <RateForm id={x.id} s={{ rate: t("c.rate"), comment: t("c.comment"), close: t("c.close") }} />
          <form action={reopen.bind(null, x.id)}>
            <SubmitButton variant="secondary" className="w-full">
              {t("c.notFixed")}
            </SubmitButton>
          </form>
        </Card>
      )}
      {x.status === "CLOSED" && x.rating && <p className="mt-4 text-sm text-ink-2">{t("c.rated", { n: x.rating })}</p>}

      <Section title={t("c.updates")}>
        <ol className="relative space-y-4 border-l border-line pl-5">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className={`absolute -left-[25px] top-1.5 size-2.5 rounded-full ${e.kind === "ESCALATED" ? "bg-red-500" : e.kind === "RATED" ? "bg-amber-400" : "bg-teal-600"}`} />
              <p className="text-[15px] text-ink">{e.note ?? (e.kind === "CREATED" ? t("c.status.OPEN") : e.kind)}</p>
              <p className="text-xs text-ink-3" title={fmtDateTime(e.createdAt, lang)}>
                {relTime(e.createdAt, lang)}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <p className="mt-8 flex items-center justify-center gap-2 text-sm text-ink-3">
        <Phone className="size-4" aria-hidden /> Help desk: dial 9 on the intercom
      </p>
    </div>
  );
}
