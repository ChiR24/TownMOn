import Link from "next/link";
import { signOut } from "@/app/actions";
import { Logo } from "@/components/ui";
import { AREAS, requireUser, type Role } from "@/lib/auth";
import { StaffNav } from "./staff-nav";

const ROLE_LABEL: Partial<Record<Role, string>> = { HELPDESK: "Help desk", ACCOUNTS: "Accounts", COMMITTEE: "Committee", MANAGER: "Duty manager" };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["HELPDESK", "ACCOUNTS", "COMMITTEE", "MANAGER"]);
  const can = (area: keyof typeof AREAS) => (AREAS[area] as readonly Role[]).includes(user.role);
  const links = [
    can("desk") && { href: "/desk", label: "Complaints" },
    can("desk") && { href: "/desk/notices", label: "Notices" },
    can("accounts") && { href: "/accounts", label: "Accounts" },
    can("accounts") && { href: "/accounts/review", label: "Review queue" },
    can("committee") && { href: "/committee", label: "Dashboard" },
    can("desk") && { href: "/desk/visitors", label: "Visitor log" },
  ].filter((l): l is { href: string; label: string } => !!l);

  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href={links[0]?.href ?? "/"} className="flex shrink-0 items-center gap-2">
            <Logo className="size-7" />
            <span className="hidden font-semibold sm:inline">Township</span>
          </Link>
          <StaffNav links={links} />
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="hidden text-right text-xs leading-tight text-ink-3 md:block">
              <span className="block font-medium text-ink-2">{user.name}</span>
              {ROLE_LABEL[user.role]}
            </span>
            <form action={signOut}>
              <button className="rounded-lg px-2.5 py-1.5 text-sm text-ink-2 hover:bg-muted hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
