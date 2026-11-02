import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LangSwitch } from "@/components/lang-switch";
import { Logo } from "@/components/ui";
import { currentUser, homeFor } from "@/lib/auth";
import { DEMO_ACCOUNTS, DEMO_MODE, TOWNSHIP } from "@/lib/config";
import { getLang } from "@/lib/lang";
import { translator, type Key } from "@/lib/i18n";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const user = await currentUser();
  if (user && !e) redirect(homeFor(user.role));
  const lang = await getLang();
  const t = translator(lang);
  const keys = ["phone", "send", "sentTo", "code", "verify", "change", "resend", "demo", "demoHint", "demoSms"] as const;
  const errs = ["phone", "wrong", "expired", "locked", "tooMany", "noaccess", "noflat"] as const;
  const s = {
    ...Object.fromEntries(keys.map((k) => [k, t(`login.${k}` as Key)])),
    ...Object.fromEntries(errs.map((k) => [`err.${k}`, t(`login.err.${k}` as Key)])),
  } as Parameters<typeof LoginForm>[0]["s"];

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-5 pb-10 pt-8">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <Logo className="size-9" />
          <span className="text-[15px] font-semibold leading-tight">
            Township
            <span className="block text-xs font-normal text-zinc-500">{TOWNSHIP}</span>
          </span>
        </span>
      </div>
      <h1 className="mt-10 text-3xl font-semibold tracking-tight text-zinc-950">{t("login.title")}</h1>
      <p className="mt-2 text-[15px] text-zinc-600">{t("login.subtitle")}</p>
      <div className="mt-8">
        <LoginForm s={s} demo={DEMO_MODE ? DEMO_ACCOUNTS : []} initialError={e === "noflat" || e === "noaccess" ? s[`err.${e}`] : undefined} />
      </div>
      <div className="mt-auto flex justify-center pt-10">
        <LangSwitch current={lang} />
      </div>
    </main>
  );
}
