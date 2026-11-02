import { eq } from "drizzle-orm";
import { ArrowLeft, Camera, CreditCard, Eye, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { LangSwitch } from "@/components/lang-switch";
import { SubmitButton } from "@/components/submit-button";
import { IconChip, RoundLink, type Tone } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { currentUser, homeFor } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { translator } from "@/lib/i18n";

export const metadata: Metadata = { title: "Privacy notice" };

// DPDP Act 2023: tell people what is kept and why before they use the app, and record their consent.
async function accept() {
  "use server";
  const u = await currentUser();
  if (!u) redirect("/login");
  await db.update(users).set({ privacyAcceptedAt: new Date() }).where(eq(users.id, u.id));
  redirect(homeFor(u.role));
}

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const u = await currentUser();
  if (!u) redirect("/login");
  const viewOnly = (await searchParams).view === "1";
  if (u.privacyAcceptedAt && !viewOnly) redirect(homeFor(u.role));
  const lang = await getLang();
  const t = translator(lang);
  const accepted = !!u.privacyAcceptedAt;
  const points: { icon: typeof Eye; text: string; tone: Tone }[] = [
    { icon: UserRound, text: t("welcome.p1"), tone: "brand" },
    { icon: CreditCard, text: t("welcome.p2"), tone: "sky" },
    { icon: Camera, text: t("welcome.p3"), tone: "peach" },
    { icon: Eye, text: t("welcome.p4"), tone: "violet" },
  ];
  return (
    <main className="app-backdrop min-h-dvh text-ink">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-[max(env(safe-area-inset-top),1.5rem)] motion-safe:animate-enter">
        {accepted ? (
          <RoundLink href={u.role === "RESIDENT" ? "/more" : homeFor(u.role)} label={t("common.back")}>
            <ArrowLeft className="size-5" aria-hidden />
          </RoundLink>
        ) : (
          <Logo className="size-11" />
        )}
        <h1 className="mt-7 text-[32px] font-semibold leading-[1.15] tracking-[-0.02em]">{t("welcome.title")}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{t("welcome.intro")}</p>
        <ul className="card mt-6 divide-y divide-line !py-1">
          {points.map(({ icon: Icon, text, tone }) => (
            <li key={text} className="flex gap-3.5 px-5 py-4">
              <IconChip tone={tone}>
                <Icon className="size-5" aria-hidden />
              </IconChip>
              <span className="pt-1 text-[15px] leading-relaxed text-ink-2">{text}</span>
            </li>
          ))}
        </ul>
        {!accepted && (
          <form action={accept} className="mt-10">
            <SubmitButton size="lg" className="w-full">
              {t("welcome.agree")}
            </SubmitButton>
          </form>
        )}
        <div className="mt-auto flex justify-center pt-10">
          <LangSwitch current={lang} />
        </div>
      </div>
    </main>
  );
}
