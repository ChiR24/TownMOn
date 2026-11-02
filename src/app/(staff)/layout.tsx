import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { AppSidebar } from "@/components/app-sidebar";
import { Logo } from "@/components/brand";
import { BottomNav, PageEnter, type NavLink } from "@/components/nav";
import { db } from "@/db";
import { bankTxns, complaints } from "@/db/schema";
import { AREAS, requireUser, type Role } from "@/lib/auth";
import { fmtLongDate, todayIST } from "@/lib/dates";

const ROLE_LABEL: Partial<Record<Role, string>> = { HELPDESK: "Help desk", ACCOUNTS: "Accounts", COMMITTEE: "Committee", MANAGER: "Duty manager" };

// The same shell as the resident app: a sidebar on computers; on phones and tablets a glass header and tab bar.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["HELPDESK", "ACCOUNTS", "COMMITTEE", "MANAGER"]);
  const can = (area: keyof typeof AREAS) => (AREAS[area] as readonly Role[]).includes(user.role);
  // Live counts beside the two queues, so the sidebar doubles as the day's to-do list.
  const [active, review] = await Promise.all([
    can("desk") ? db.select({ n: count() }).from(complaints).where(and(isNull(complaints.parentId), inArray(complaints.status, ["OPEN", "ASSIGNED", "IN_PROGRESS"]))) : [{ n: 0 }],
    can("accounts") ? db.select({ n: count() }).from(bankTxns).where(eq(bankTxns.status, "NEEDS_REVIEW")) : [{ n: 0 }],
  ]);
  const links = [
    can("desk") && { href: "/desk", label: "Complaints", icon: "complaints", count: active[0].n },
    can("desk") && { href: "/desk/notices", label: "Notices", icon: "notices" },
    can("accounts") && { href: "/accounts", label: "Accounts", icon: "accounts" },
    can("accounts") && { href: "/accounts/review", label: "Review queue", icon: "review", count: review[0].n },
    can("committee") && { href: "/committee", label: "Dashboard", icon: "dashboard" },
    can("desk") && { href: "/desk/visitors", label: "Visitor log", icon: "visitors" },
  ].filter((l): l is NavLink => !!l);
  const home = links[0]?.href ?? "/";

  return (
    <div className="app-backdrop min-h-dvh text-ink lg:flex lg:gap-5 lg:p-4">
      <AppSidebar home={home} links={links} navLabel="Staff" name={user.name} subtitle={ROLE_LABEL[user.role] ?? ""} signOutLabel="Sign out" />
      <div className="w-full min-w-0">
        <header className="edge-top no-print sticky top-0 z-20 flex items-center gap-2 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] lg:hidden">
          <Link href={home} className="glass press flex size-11 items-center justify-center rounded-full" aria-label="Township">
            <Logo className="size-7" />
          </Link>
          <form action={signOut} className="ml-auto">
            <button className="glass press flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-ink">
              <LogOut className="size-4" aria-hidden /> Sign out
            </button>
          </form>
        </header>
        <main className={`mx-auto w-full max-w-6xl px-4 pt-3 lg:px-2 lg:py-3 ${links.length > 1 ? "pb-32" : "pb-10"}`}>
          <p className="no-print mb-1 text-sm font-medium text-ink-3">{fmtLongDate(todayIST())}</p>
          <PageEnter>{children}</PageEnter>
        </main>
        <BottomNav links={links} label="Staff" />
      </div>
    </div>
  );
}
