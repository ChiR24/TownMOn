import { eq } from "drizzle-orm";
import { Camera, CreditCard, Eye, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LangSwitch } from "@/components/lang-switch";
import { SubmitButton } from "@/components/submit-button";
import { Logo } from "@/components/ui";
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
  const points = [
    { icon: UserRound, text: t("welcome.p1") },
    { icon: CreditCard, text: t("welcome.p2") },
    { icon: Camera, text: t("welcome.p3") },
    { icon: Eye, text: t("welcome.p4") },
  ];
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-8">
      <Logo className="size-9" />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">{t("welcome.title")}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">{t("welcome.intro")}</p>
      <ul className="mt-6 space-y-4">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-800">
              <Icon className="size-4.5" aria-hidden />
            </span>
            <span className="pt-1.5 text-[15px] leading-relaxed text-zinc-800">{text}</span>
          </li>
        ))}
      </ul>
      {!viewOnly && (
        <form action={accept} className="mt-10">
          <SubmitButton size="lg" className="w-full">
            {t("welcome.agree")}
          </SubmitButton>
        </form>
      )}
      <div className="mt-auto flex justify-center pt-10">
        <LangSwitch current={lang} />
      </div>
    </main>
  );
}
