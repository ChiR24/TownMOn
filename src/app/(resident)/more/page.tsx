import { and, desc, eq, isNull, or } from "drizzle-orm";
import { CalendarDays, ChevronRight, LogOut, Megaphone, MessageSquareText, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { LangSwitch } from "@/components/lang-switch";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, Badge, Card, cardCls, cx, EmptyState, IconChip, PageTitle, Section } from "@/components/ui";
import { db } from "@/db";
import { flatMembers, notices, notifications, users } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { relTime } from "@/lib/dates";
import { getLang } from "@/lib/lang";
import { translator, type Key } from "@/lib/i18n";
import { maskPhone } from "@/lib/phone";
import { removeMember } from "./actions";
import { MarkRead } from "./mark-read";
import { MemberForm } from "./member-form";

export const metadata: Metadata = { title: "More" };

export default async function MorePage() {
  const { user, flat } = await requireResident();
  const lang = await getLang();
  const t = translator(lang);
  const [members, notes, messages] = await Promise.all([
    db
      .select({ id: flatMembers.id, name: users.name, phone: users.phone, relation: flatMembers.relation, isPrimary: flatMembers.isPrimary, userId: users.id })
      .from(flatMembers)
      .innerJoin(users, eq(users.id, flatMembers.userId))
      .where(and(eq(flatMembers.flatId, flat.flatId), eq(flatMembers.active, true))),
    db.select().from(notices).where(or(isNull(notices.tower), eq(notices.tower, flat.tower))).orderBy(desc(notices.createdAt)).limit(10),
    db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(15),
  ]);
  const me = members.find((m) => m.userId === user.id);
  const row = "flex items-center gap-3 px-5 py-4 text-[15px] font-semibold hover:bg-muted";

  return (
    <div>
      <PageTitle title={t("m.title")} />

      <section className={cx(cardCls, "flex items-center gap-4")}>
        <Avatar name={user.name} className="size-16 text-xl" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-ink-3">
            {me ? `${t(`m.rel.${me.relation}` as Key)} · ` : ""}
            {flat.flatId} · {maskPhone(user.phone)}
          </p>
        </div>
      </section>

      <Link href="/amenities" className={cx(cardCls, "press mt-3 flex items-center gap-3 !py-4")}>
        <IconChip tone="sky">
          <CalendarDays className="size-5" aria-hidden />
        </IconChip>
        <span className="flex-1 text-[15px] font-semibold">{t("a.title")}</span>
        <ChevronRight className="size-5 text-ink-3" aria-hidden />
      </Link>

      <Section title={t("m.household")}>
        <Card className="space-y-4">
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0">
                <Avatar name={m.name} className="size-11 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">
                    {m.name} {m.userId === user.id && <span className="text-xs font-normal text-ink-3">({t("m.you")})</span>}
                  </p>
                  <p className="text-xs text-ink-3">
                    {t(`m.rel.${m.relation}` as Key)} · {maskPhone(m.phone)}
                  </p>
                </div>
                {flat.isPrimary && !m.isPrimary && m.relation === "FAMILY" && (
                  <form action={removeMember.bind(null, m.id)}>
                    <SubmitButton size="sm" variant="ghost">
                      {t("m.remove")}
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {flat.isPrimary ? (
            <MemberForm s={{ name: t("m.name"), phone: t("login.phone"), add: t("m.add"), hint: t("m.addHint"), taken: t("m.err.phoneTaken"), badPhone: t("login.err.phone"), badName: t("m.err.name"), added: t("m.added") }} />
          ) : (
            <p className="text-sm text-ink-3">{t("m.onlyPrimary")}</p>
          )}
        </Card>
      </Section>

      <Section title={t("m.language")}>
        <LangSwitch current={lang} />
      </Section>

      <Section title={t("m.notices")}>
        <div id="notices" className="scroll-mt-20" />
        {notes.length === 0 ? (
          <EmptyState icon={<Megaphone className="size-5" aria-hidden />} title={t("m.noNotices")} />
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className={cardCls}>
                <p className="text-[15px] font-semibold leading-snug">{n.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{n.body}</p>
                <p className="mt-1.5 text-xs text-ink-3">{relTime(n.createdAt, lang)}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("m.messages")}>
        <div id="messages" className="scroll-mt-20" />
        {messages.some((m) => !m.readAt) && <MarkRead />}
        {messages.length === 0 ? (
          <EmptyState icon={<MessageSquareText className="size-5" aria-hidden />} title={t("m.noMessages")} />
        ) : (
          <ul className={cx(cardCls, "divide-y divide-line !py-1")}>
            {messages.map((m) => (
              <li key={m.id} className="flex gap-3 py-3.5">
                <span className={cx("mt-2 size-2 shrink-0 rounded-full", m.readAt ? "bg-transparent" : "bg-red-500")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">{m.link ? <Link href={m.link} className="hover:underline">{m.title}</Link> : m.title}</p>
                  {m.body && <p className="mt-0.5 text-sm text-ink-3">{m.body}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    {relTime(m.createdAt, lang)} {m.channel !== "APP" && <Badge tone="zinc">{m.channel === "WHATSAPP" ? "WhatsApp (mock)" : "SMS (mock)"}</Badge>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className={cx(cardCls, "mt-9 divide-y divide-line overflow-hidden !p-0")}>
        <Link href="/welcome?view=1" className={row}>
          <ShieldCheck className="size-5 text-ink-3" aria-hidden />
          <span className="flex-1">{t("m.privacy")}</span>
          <ChevronRight className="size-5 text-ink-3" aria-hidden />
        </Link>
        <form action={signOut}>
          <button className={cx(row, "w-full text-left text-red-700 dark:text-red-300")}>
            <LogOut className="size-5" aria-hidden /> {t("m.signOut")}
          </button>
        </form>
      </div>
    </div>
  );
}
