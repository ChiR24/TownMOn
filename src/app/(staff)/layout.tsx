import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { Logo } from "@/components/brand";
import { Avatar } from "@/components/ui";
import { db } from "@/db";
import { bankTxns, complaints } from "@/db/schema";
import { AREAS, requireUser, type Role } from "@/lib/auth";
import { fmtLongDate, todayIST } from "@/lib/dates";
import { StaffNav, type NavLink } from "./staff-nav";

const ROLE_LABEL: Partial<Record<Role, string>> = { HELPDESK: "Help desk", ACCOUNTS: "Accounts", COMMITTEE: "Committee", MANAGER: "Duty manager" };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["HELPDESK", "ACCOUNTS", "COMMITTEE", "MANAGER"]);
  const can = (area: keyof typeof AREAS) => (AREAS[area] as readonly Role[]).includes(user.role);
  // Live counts beside the two queues, so the sidebar doubles as the day's to-do list.
  const [active, review] = await Promise.all([
    can("desk") ? db.select({ n: count() }).from(complaints).where(and(isNull(complaints.parentId), inArray(complaints.status, ["OPEN", "ASSIGNED", "IN_PROGRESS"]))) : [{ n: 0 }],
    can("accounts") ? db.select({ n: count() }).from(bankTxns).where(eq(bankTxns.status, "NEEDS_REVIEW")) : [{ n: 0 }],
  ]);
  const links = [
    can("desk") && { href: "/desk", label: "Complaints", icon: "desk", count: active[0].n },
    can("desk") && { href: "/desk/notices", label: "Notices", icon: "notices" },
    can("accounts") && { href: "/accounts", label: "Accounts", icon: "accounts" },
    can("accounts") && { href: "/accounts/review", label: "Review queue", icon: "review", count: review[0].n },
    can("committee") && { href: "/committee", label: "Dashboard", icon: "dashboard" },
    can("desk") && { href: "/desk/visitors", label: "Visitor log", icon: "visitors" },
  ].filter((l): l is NavLink => !!l);
  const home = links[0]?.href ?? "/";

  return (
    <div className="min-h-dvh lg:flex lg:gap-5 lg:p-4">
      <aside className="card no-print sticky top-4 hidden h-[calc(100dvh-2rem)] w-64 shrink-0 flex-col p-4 lg:flex">
        <Link href={home} className="flex items-center gap-2.5 px-2 pt-1">
          <Logo className="size-9" />
          <span className="text-lg font-semibold">Township</span>
        </Link>
        <StaffNav links={links} vertical />
        <div className="mt-auto flex items-center gap-3 rounded-[22px] bg-[linear-gradient(135deg,#eef8d6,#f3eefe)] p-3">
          <Avatar name={user.name} className="size-10 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="text-xs text-ink-3">{ROLE_LABEL[user.role]}</p>
          </div>
          <form action={signOut}>
            <button className="press rounded-full p-2 text-ink-2 hover:bg-white/70 hover:text-ink" aria-label="Sign out" title="Sign out">
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </aside>

      <header className="no-print sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href={home} className="shrink-0" aria-label="Township">
            <Logo className="size-8" />
          </Link>
          <StaffNav links={links} />
          <form action={signOut} className="ml-auto shrink-0">
            <button className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-muted hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 lg:px-2 lg:py-3">
        <p className="no-print mb-1 text-sm font-medium text-ink-3">{fmtLongDate(todayIST())}</p>
        {children}
      </main>
    </div>
  );
}
