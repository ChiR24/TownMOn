import { and, desc, eq, gt, gte, isNull, ne } from "drizzle-orm";
import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { VisitorStatus } from "@/components/badges";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, Card, EmptyState, PageTitle, Section } from "@/components/ui";
import { db } from "@/db";
import { guestCodes, visitors } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { TOWNSHIP } from "@/lib/config";
import { daysAgo, fmtDateTime, fmtTime, relTime } from "@/lib/dates";
import { getLang } from "@/lib/lang";
import { translator, type Key } from "@/lib/i18n";
import { decideVisitor } from "./actions";
import { revokeCode } from "./code-actions";
import { CodeForm } from "./code-form";

export const metadata: Metadata = { title: "Visitors" };

export default async function VisitorsPage() {
  const { flat } = await requireResident();
  const lang = await getLang();
  const t = translator(lang);
  const week = daysAgo(7);
  const cols = { id: visitors.id, name: visitors.name, purpose: visitors.purpose, gate: visitors.gate, status: visitors.status, photoId: visitors.photoId, arrivedAt: visitors.arrivedAt, approvalMode: visitors.approvalMode };
  const [waiting, recent, codes] = await Promise.all([
    db.select(cols).from(visitors).where(and(eq(visitors.flatId, flat.flatId), eq(visitors.status, "PENDING"))).orderBy(desc(visitors.arrivedAt)),
    db.select(cols).from(visitors).where(and(eq(visitors.flatId, flat.flatId), ne(visitors.status, "PENDING"), gte(visitors.arrivedAt, week))).orderBy(desc(visitors.arrivedAt)).limit(40),
    db.select().from(guestCodes).where(and(eq(guestCodes.flatId, flat.flatId), isNull(guestCodes.revokedAt), gt(guestCodes.validTo, new Date()))).orderBy(desc(guestCodes.createdAt)),
  ]);
  const inside = recent.filter((v) => v.status === "INSIDE");

  return (
    <div>
      <PageTitle title={t("v.title")} />

      <Section title={t("v.waiting")} className="mt-0">
        {waiting.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("v.none")}</p>
        ) : (
          <ul className="space-y-3">
            {waiting.map((v) => (
              <li key={v.id}>
                <Card className="bg-amber-50/60 ring-amber-200">
                  <div className="flex items-center gap-3">
                    {v.photoId ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private, access-checked photo route
                      <img src={`/api/photos/${v.photoId}`} alt="" className="size-16 rounded-xl object-cover" />
                    ) : (
                      <Avatar name={v.name} className="size-16 rounded-xl text-lg" />
                    )}
                    <div>
                      <p className="text-[15px] font-semibold">{v.name}</p>
                      <p className="text-sm text-zinc-600">
                        {t(`v.purpose.${v.purpose}` as Key)} · {t("v.at", { gate: v.gate, time: relTime(v.arrivedAt, lang) })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <form action={decideVisitor.bind(null, v.id, "APPROVED")}>
                      <SubmitButton className="w-full">{t("home.letIn")}</SubmitButton>
                    </form>
                    <form action={decideVisitor.bind(null, v.id, "DENIED")}>
                      <SubmitButton variant="secondary" className="w-full">
                        {t("home.deny")}
                      </SubmitButton>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {inside.length > 0 && (
        <Section title={t("v.inside")}>
          <ul className="divide-y divide-zinc-100 rounded-2xl bg-white ring-1 ring-zinc-200/80">
            {inside.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-3.5 py-3">
                <Avatar name={v.name} className="size-9 text-xs" />
                <p className="flex-1 text-[15px]">{v.name}</p>
                <span className="text-xs text-zinc-500">{fmtTime(v.arrivedAt, lang)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t("v.codes")}>
        <div id="codes" className="scroll-mt-20" />
        <Card>
          <p className="mb-4 text-sm text-zinc-600">{t("v.codesHint")}</p>
          <CodeForm
            place={TOWNSHIP}
            s={{
              guestName: t("v.guestName"),
              validFor: t("v.validFor"),
              create: t("v.create"),
              share: t("v.share"),
              codeFor: t("v.codeFor"),
              h4: t("v.hours", { n: 4 }),
              d1: t("v.days", { n: 1 }),
              d3: t("v.days", { n: 3 }),
              shareText: t("v.shareText"),
              validTill: t("v.validTill"),
            }}
          />
        </Card>
        {codes.length > 0 && (
          <ul className="mt-3 divide-y divide-zinc-100 rounded-2xl bg-white ring-1 ring-zinc-200/80">
            {codes.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3.5 py-3">
                <KeyRound className="size-4 text-teal-700" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px]">{c.guestName}</p>
                  <p className="text-xs text-zinc-500">{c.usedAt ? `${t("v.used")} ${fmtDateTime(c.usedAt, lang)}` : t("v.validTill", { time: fmtDateTime(c.validTo, lang) })}</p>
                </div>
                {!c.usedAt && (
                  <form action={revokeCode.bind(null, c.id)}>
                    <SubmitButton size="sm" variant="ghost">
                      {t("v.revoke")}
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("v.recent")}>
        {recent.length === 0 ? (
          <EmptyState title={t("v.none")} />
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-2xl bg-white ring-1 ring-zinc-200/80">
            {recent.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-3.5 py-3">
                <Avatar name={v.name} className="size-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px]">{v.name}</p>
                  <p className="text-xs text-zinc-500">
                    {t(`v.purpose.${v.purpose}` as Key)} · {t("v.at", { gate: v.gate, time: fmtDateTime(v.arrivedAt, lang) })}
                  </p>
                </div>
                <VisitorStatus status={v.status} t={t} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
