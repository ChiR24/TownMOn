import { and, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo, TownshipArt } from "@/components/brand";
import { LangSwitch } from "@/components/lang-switch";
import { db } from "@/db";
import { flatMembers, users } from "@/db/schema";
import { currentUser, homeFor } from "@/lib/auth";
import { DEMO_MODE, DEMO_PHONES, TOWNSHIP } from "@/lib/config";
import { flatPosition } from "@/lib/data";
import { getLang } from "@/lib/lang";
import { translator, type Key } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ROLE: Record<string, [label: string, note: string]> = {
  HELPDESK: ["Help desk", "Complaints queue"],
  ACCOUNTS: ["Accounts", "Bank matching"],
  COMMITTEE: ["Committee", "Dashboard and report"],
  MANAGER: ["Duty manager", "Sees every staff area"],
  GUARD: ["Guard", "Gate tablet"],
  TECHNICIAN: ["Technician", "Assigned jobs"],
};

/** The one-tap demo logins, read from the seeded database: names, flats and dues are always the live ones. */
async function demoAccounts() {
  const rows = await db
    .select({ phone: users.phone, name: users.name, role: users.role, flatId: flatMembers.flatId, relation: flatMembers.relation })
    .from(users)
    .leftJoin(flatMembers, and(eq(flatMembers.userId, users.id), eq(flatMembers.active, true)))
    .where(inArray(users.phone, DEMO_PHONES));
  const people = DEMO_PHONES.map((p) => rows.find((r) => r.phone === p)).filter((r) => r !== undefined);
  return Promise.all(
    people.map(async (u) => {
      if (u.role !== "RESIDENT" || !u.flatId) return { phone: u.phone, name: u.name, role: ROLE[u.role]?.[0] ?? "Resident", note: ROLE[u.role]?.[1] ?? "" };
      const { balance, daysOverdue } = await flatPosition(u.flatId);
      const dues = balance <= 0 ? "all paid" : daysOverdue > 0 ? `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue` : `${rupees(balance)} due`;
      return { phone: u.phone, name: u.name, role: u.relation === "TENANT" ? "Resident (tenant)" : "Resident", note: `${u.flatId} · ${dues}` };
    }),
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const user = await currentUser();
  if (user && !e) redirect(homeFor(user.role));
  const lang = await getLang();
  const t = translator(lang);
  const keys = ["phone", "send", "sentTo", "code", "verify", "change", "resend", "demo", "demoHint", "demoSms", "use"] as const;
  const errs = ["phone", "wrong", "expired", "locked", "tooMany", "noaccess", "noflat"] as const;
  const s = {
    ...Object.fromEntries(keys.map((k) => [k, t(`login.${k}` as Key)])),
    ...Object.fromEntries(errs.map((k) => [`err.${k}`, t(`login.err.${k}` as Key)])),
  } as Parameters<typeof LoginForm>[0]["s"];

  return (
    <main className="app-backdrop min-h-dvh text-ink">
      <div className="mx-auto max-w-md px-4 pb-10 pt-[max(env(safe-area-inset-top),1.25rem)] motion-safe:animate-enter">
        <div className="flex items-center gap-2.5 px-1">
          <Logo className="size-10" />
          <p className="text-lg font-semibold">Township</p>
        </div>
        <div className="mt-5 overflow-hidden rounded-[32px] shadow-[0_18px_40px_-24px_rgb(18_18_18/0.35)]">
          <TownshipArt className="h-44 w-full" />
        </div>
        <h1 className="mt-7 px-1 text-[30px] font-semibold leading-[1.12] tracking-[-0.02em]">
          {t("login.title")}
          <span className="block text-ink-3">{TOWNSHIP}</span>
        </h1>
        <p className="mt-2.5 px-1 text-[15px] leading-relaxed text-ink-2">{t("login.subtitle")}</p>
        <div className="card mt-6 p-5">
          <LoginForm s={s} demo={DEMO_MODE ? await demoAccounts() : []} initialError={e === "noflat" || e === "noaccess" ? s[`err.${e}`] : undefined} />
        </div>
        <div className="mt-8 flex justify-center">
          <LangSwitch current={lang} />
        </div>
      </div>
    </main>
  );
}
