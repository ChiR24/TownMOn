import { asc, eq } from "drizzle-orm";
import { CircleCheck, Clock, Link2, Phone, Siren } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STAGES } from "@/components/complaint-row";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Notice, PageTitle, Section } from "@/components/ui";
import { Steps } from "@/components/viz";
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
  const steps = STAGES.map((s) => t(s === "RESOLVED" ? "c.step.RESOLVED" : (`c.status.${s}` as Key)));

  return (
    <div>
      <PageTitle title={t(`cat.${x.category}` as Key)} subtitle={`#${x.id} · ${fmtDateTime(x.createdAt, lang)}`} back={{ href: "/complaints", label: t("common.back") }} />

      {isNew && (
        <Notice tone="emerald" icon={<CircleCheck className="size-4" aria-hidden />} className="mb-4">
          {t("c.sent")}
        </Notice>
      )}
      {x.safety && x.status !== "CLOSED" && (
        <Notice tone="red" icon={<Siren className="size-4" aria-hidden />} className="mb-4">
          <p className="font-semibold">{t("c.emergency")}</p>
          <p>{t("c.call112")}</p>
        </Notice>
      )}

      <Card className="!px-3 !pb-4 !pt-5">
        <Steps steps={steps} current={STAGES.indexOf(x.status as (typeof STAGES)[number])} label={t("c.progress")} />
      </Card>

      <Card className="mt-3 space-y-3.5">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{x.description}</p>
        {x.photoId && (
          // eslint-disable-next-line @next/next/no-img-element -- private, access-checked photo route
          <img src={`/api/photos/${x.photoId}`} alt="" className="max-h-64 rounded-[20px] object-cover" />
        )}
        <div className="flex flex-wrap gap-2 text-sm text-ink-2">
          {c.tech && <Badge tone="brand">{t("c.with", { name: c.tech })}</Badge>}
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
        <Card className="mt-3 space-y-4 ring-2 ring-accent">
          <p className="text-[17px] font-semibold text-ink">{t("c.status.RESOLVED")}</p>
          <RateForm id={x.id} s={{ rate: t("c.rate"), comment: t("c.comment"), close: t("c.close"), err: t("c.err.rating") }} />
          <form action={reopen.bind(null, x.id)}>
            <SubmitButton variant="secondary" className="w-full">
              {t("c.notFixed")}
            </SubmitButton>
          </form>
        </Card>
      )}
      {x.status === "CLOSED" && x.rating && <p className="mt-4 px-1 text-sm text-ink-2">{t("c.rated", { n: x.rating })}</p>}

      <Section title={t("c.updates")}>
        <Card>
          <ol className="relative space-y-5 border-l-2 border-line pl-5">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className={`absolute -left-[27px] top-1.5 size-3 rounded-full ring-4 ring-surface ${e.kind === "ESCALATED" ? "bg-red-500" : e.kind === "RATED" ? "bg-amber-400" : "bg-ink"}`} />
                <p className="text-[15px] text-ink">{e.note ?? (e.kind === "CREATED" ? t("c.status.OPEN") : e.kind)}</p>
                <p className="mt-0.5 text-xs text-ink-3" title={fmtDateTime(e.createdAt, lang)}>
                  {relTime(e.createdAt, lang)}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </Section>

      <p className="mt-8 flex items-center justify-center gap-2 text-sm text-ink-3">
        <Phone className="size-4" aria-hidden /> {t("c.helpdesk")}
      </p>
    </div>
  );
}
