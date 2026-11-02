import { LogOut } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { Logo } from "@/components/brand";
import { SideNav, type NavLink } from "@/components/nav";
import { Avatar } from "@/components/ui";

/** The wide-screen sidebar every role shares: the brand, the navigation, who is signed in, and sign out. */
export function AppSidebar({ home, links, navLabel, name, subtitle, signOutLabel }: { home: string; links: NavLink[]; navLabel: string; name: string; subtitle: string; signOutLabel: string }) {
  return (
    <aside className="card no-print sticky top-4 hidden h-[calc(100dvh-2rem)] w-64 shrink-0 flex-col p-4 lg:flex">
      <Link href={home} className="flex items-center gap-2.5 px-2 pt-1">
        <Logo className="size-9" />
        <span className="text-lg font-semibold">Township</span>
      </Link>
      <SideNav links={links} label={navLabel} />
      <div className="mt-auto rounded-[22px] bg-accent-soft p-3">
        <div className="flex items-center gap-3">
          <Avatar name={name} className="size-10 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-ink-3">{subtitle}</p>
          </div>
        </div>
        <form action={signOut} className="mt-2">
          <button className="press flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium text-ink-2 hover:bg-surface hover:text-ink">
            <LogOut className="size-4" aria-hidden /> {signOutLabel}
          </button>
        </form>
      </div>
    </aside>
  );
}
