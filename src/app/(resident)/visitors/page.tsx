import { and, desc, eq, gt, gte, isNull, ne } from "drizzle-orm";
import { KeyRound, Users } from "lucide-react";
import type { Metadata } from "next";
import { VisitorStatus } from "@/components/badges";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, Card, cardCls, cx, EmptyState, IconChip, PageTitle, Section } from "@/components/ui";
import { db } from "@/db";
import { guestCodes, visitors } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { TOWNSHIP } from "@/lib/config";
import { daysAgo, fmtDateTime, fmtTime } from "@/lib/dates";
import { getLang } from "@/lib/lang";
import { translator, type Key } from "@/lib/i18n";
import { GateRequest } from "../gate-request";
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
          <p className="px-1 text-sm text-ink-3">{t("v.none")}</p>
        ) : (
          <div className="space-y-3">
            {waiting.map((v) => (
              <GateRequest key={v.id} v={v} t={t} lang={lang} />
            ))}
          </div>
        )}
      </Section>

      {inside.length > 0 && (
        <Section title={t("v.inside")}>
          <ul className={cx(cardCls, "divide-y divide-line !py-1")}>
            {inside.map((v) => (
              <li key={v.id} className="flex items-center gap-3 py-3">
                <Avatar name={v.name} className="size-11 text-sm" />
                <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{v.name}</p>
                <span className="text-xs text-ink-3">{fmtTime(v.arrivedAt, lang)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t("v.codes")}>
        <div id="codes" className="scroll-mt-20" />
        <Card>
          <p className="mb-5 text-sm leading-relaxed text-ink-2">{t("v.codesHint")}</p>
          <CodeForm
            place={TOWNSHIP}
            lang={lang}
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
              nameError: t("v.err.name"),
            }}
          />
        </Card>
        {codes.length > 0 && (
          <ul className={cx(cardCls, "mt-3 divide-y divide-line !py-1")}>
            {codes.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <IconChip tone="violet">
                  <KeyRound className="size-5" aria-hidden />
                </IconChip>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{c.guestName}</p>
                  <p className="text-xs text-ink-3">{c.usedAt ? `${t("v.used")} ${fmtDateTime(c.usedAt, lang)}` : t("v.validTill", { time: fmtDateTime(c.validTo, lang) })}</p>
                </div>
                {!c.usedAt && (
                  <form action={revokeCode.bind(null, c.id)}>
                    <SubmitButton size="sm" variant="ghost" aria-label={`${t("v.revoke")}: ${c.guestName}`}>
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
          <EmptyState icon={<Users className="size-5" aria-hidden />} title={t("v.none")} />
        ) : (
          <ul className={cx(cardCls, "divide-y divide-line !py-1")}>
            {recent.map((v) => (
              <li key={v.id} className="flex items-center gap-3 py-3">
                <Avatar name={v.name} className="size-11 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{v.name}</p>
                  <p className="truncate text-xs text-ink-3">
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
