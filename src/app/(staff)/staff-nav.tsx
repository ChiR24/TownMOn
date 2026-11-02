"use client";

import { ChartPie, ListChecks, Megaphone, Users, Wallet, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = { desk: Wrench, notices: Megaphone, accounts: Wallet, review: ListChecks, dashboard: ChartPie, visitors: Users } as const;
export type NavLink = { href: string; label: string; icon: keyof typeof ICONS; count?: number };

/** Staff navigation: a sidebar with live counts on wide screens, a scrolling row of pills on phones. */
export function StaffNav({ links, vertical }: { links: NavLink[]; vertical?: boolean }) {
  const path = usePathname();
  // The most specific link that matches wins, so "/accounts/review" doesn't also light up "/accounts".
  const active = links.map((l) => l.href).filter((h) => path === h || path.startsWith(`${h}/`)).sort((a, b) => b.length - a.length)[0];
  if (!vertical) {
    return (
      <nav className="-mx-1 flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Staff">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={l.href === active ? "page" : undefined}
            className={`press whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${l.href === active ? "bg-cta text-cta-ink" : "text-ink-2 hover:bg-muted hover:text-ink"}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="mt-6 space-y-1" aria-label="Staff">
      {links.map((l) => {
        const Icon = ICONS[l.icon];
        const on = l.href === active;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={`press flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold ${on ? "bg-cta text-cta-ink" : "text-ink-2 hover:bg-muted hover:text-ink"}`}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            <span className="flex-1">{l.label}</span>
            {!!l.count && <span className={`min-w-6 rounded-full px-2 py-0.5 text-center text-xs tabular-nums ${on ? "bg-white/20" : "bg-muted text-ink-2"}`}>{l.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
