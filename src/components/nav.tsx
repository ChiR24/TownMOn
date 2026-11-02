"use client";

import { ChartPie, House, ListChecks, Megaphone, Menu, ReceiptIndianRupee, Users, Wallet, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The app's navigation, the same for every role: a floating tab bar on phones and tablets, a sidebar on computers.
const ICONS = { home: House, bills: ReceiptIndianRupee, complaints: Wrench, notices: Megaphone, accounts: Wallet, review: ListChecks, dashboard: ChartPie, visitors: Users, more: Menu } as const;
/** `also`: other paths that light this link up (More stays lit on the amenity pages it leads to). */
export type NavLink = { href: string; label: string; icon: keyof typeof ICONS; count?: number; also?: string[] };

/** The most specific link that matches wins, so "/accounts/review" doesn't also light up "/accounts". */
function useActive(links: NavLink[]) {
  const path = usePathname();
  const hit = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(`${h}/`));
  return links.filter((l) => hit(l.href) || l.also?.some(hit)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** Wide screens: a sidebar, with live counts beside the queues. */
export function SideNav({ links, label }: { links: NavLink[]; label: string }) {
  const active = useActive(links);
  return (
    <nav className="mt-6 space-y-1" aria-label={label}>
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
            {!!l.count && <span className={`min-w-6 rounded-full px-2 py-0.5 text-center text-xs tabular-nums ${on ? "bg-cta-ink/15" : "bg-muted text-ink-2"}`}>{l.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Phones and tablets: a floating glass tab bar. The current tab becomes a pill with its name; the others are icons,
 * named for screen readers and on hover. One destination needs no bar. Past five tabs (the duty manager has six) a
 * name no longer fits beside the icons on a phone, so the current tab is a filled icon like the rest.
 */
export function BottomNav({ links, label }: { links: NavLink[]; label: string }) {
  const active = useActive(links);
  if (links.length < 2) return null;
  const named = links.length <= 5;
  return (
    <nav className="edge-bottom no-print fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),0.875rem)] lg:hidden" aria-label={label}>
      <ul className="glass mx-auto flex max-w-md items-center justify-between gap-0.5 rounded-full p-1.5">
        {links.map((l) => {
          const Icon = ICONS[l.icon];
          const on = l.href === active;
          return (
            <li key={l.href} className={on ? "min-w-0" : undefined}>
              <Link
                href={l.href}
                aria-label={l.label}
                title={l.label}
                aria-current={on ? "page" : undefined}
                className={`press flex h-12 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors ${on ? `bg-cta text-cta-ink ${named ? "px-3" : "w-11"}` : "w-11 text-ink-3 hover:text-ink"}`}
              >
                <Icon className="size-[22px] shrink-0" strokeWidth={on ? 2.2 : 1.9} aria-hidden />
                {on && named && <span className="truncate">{l.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Each page eases in when you navigate (skipped for people who ask for reduced motion). */
export function PageEnter({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div key={path} className="motion-safe:animate-enter">
      {children}
    </div>
  );
}
