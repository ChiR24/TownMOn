import { and, desc, eq, isNull, or } from "drizzle-orm";
import { CalendarDays, ChevronRight, LogOut, MessageSquareText, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { LangSwitch } from "@/components/lang-switch";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Section } from "@/components/ui";
import { db } from "@/db";
import { flatMembers, notices, notifications, users } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { relTime } from "@/lib/dates";
import { getLang } from "@/lib/lang";
import { translator, type Key } from "@/lib/i18n";
import { maskPhone } from "@/lib/phone";
import { removeMember } from "./actions";
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

  return (
    <div>
      <h1 className="mb-5 mt-2 text-2xl font-semibold tracking-tight">{t("m.title")}</h1>

      <Link href="/amenities" className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200/80 hover:bg-zinc-50">
        <CalendarDays className="size-5 text-teal-700" aria-hidden />
        <span className="flex-1 text-[15px] font-medium">{t("a.title")}</span>
        <ChevronRight className="size-4 text-zinc-400" aria-hidden />
      </Link>

      <Section title={t("m.household")}>
        <Card className="space-y-4">
          <ul className="divide-y divide-zinc-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-[15px] font-medium">
                    {m.name} {m.userId === user.id && <span className="text-xs font-normal text-zinc-500">(you)</span>}
                  </p>
                  <p className="text-xs text-zinc-500">
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
            <MemberForm s={{ name: t("m.name"), phone: t("login.phone"), add: t("m.add"), hint: t("m.addHint"), taken: t("m.err.phoneTaken"), badPhone: t("login.err.phone"), badName: t("c.err.short") }} />
          ) : (
            <p className="text-sm text-zinc-500">{t("m.onlyPrimary")}</p>
          )}
        </Card>
      </Section>

      <Section title={t("m.language")}>
        <LangSwitch current={lang} />
      </Section>

      <Section title={t("m.notices")}>
        <div id="notices" className="scroll-mt-20" />
        {notes.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("m.noNotices")}</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-200/80">
                <p className="text-[15px] font-medium">{n.title}</p>
                <p className="mt-0.5 text-sm text-zinc-600">{n.body}</p>
                <p className="mt-1 text-xs text-zinc-400">{relTime(n.createdAt, lang)}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Messages">
        <ul className="divide-y divide-zinc-100 rounded-2xl bg-white ring-1 ring-zinc-200/80">
          {messages.map((m) => (
            <li key={m.id} className="flex gap-3 px-3.5 py-3">
              <MessageSquareText className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[15px]">{m.link ? <Link href={m.link}>{m.title}</Link> : m.title}</p>
                {m.body && <p className="text-sm text-zinc-500">{m.body}</p>}
                <p className="mt-0.5 text-xs text-zinc-400">
                  {relTime(m.createdAt, lang)} {m.channel !== "APP" && <Badge tone="zinc">{m.channel === "WHATSAPP" ? "WhatsApp (mock)" : "SMS (mock)"}</Badge>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <div className="mt-8 space-y-2">
        <Link href="/welcome?view=1" className="flex items-center gap-3 rounded-2xl bg-white p-4 text-[15px] ring-1 ring-zinc-200/80 hover:bg-zinc-50">
          <ShieldCheck className="size-5 text-zinc-500" aria-hidden /> {t("m.privacy")}
        </Link>
        <form action={signOut}>
          <button className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left text-[15px] text-red-700 ring-1 ring-zinc-200/80 hover:bg-zinc-50">
            <LogOut className="size-5" aria-hidden /> {t("m.signOut")}
          </button>
        </form>
      </div>
    </div>
  );
}
