"use client";

import { House, Menu, ReceiptIndianRupee, Users, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", key: "home", icon: House },
  { href: "/bills", key: "bills", icon: ReceiptIndianRupee },
  { href: "/complaints", key: "complaints", icon: Wrench },
  { href: "/visitors", key: "visitors", icon: Users },
  { href: "/more", key: "more", icon: Menu },
] as const;

/**
 * A floating glass tab bar. The current tab becomes a dark pill with its name; the others are icons, named for
 * screen readers and on hover.
 */
export function BottomNav({ labels }: { labels: Record<(typeof ITEMS)[number]["key"], string> }) {
  const path = usePathname();
  return (
    <nav className="edge-bottom no-print fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),0.875rem)]" aria-label="Main">
      <ul className="glass mx-auto flex max-w-md items-center justify-between gap-1 rounded-full p-1.5">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href) || (key === "more" && path.startsWith("/amenities"));
          return (
            <li key={key} className={active ? "min-w-0" : undefined}>
              <Link
                href={href}
                aria-label={labels[key]}
                title={labels[key]}
                aria-current={active ? "page" : undefined}
                className={`press flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors ${
                  active ? "bg-cta px-4 text-cta-ink" : "w-12 text-ink-3 hover:text-ink"
                }`}
              >
                <Icon className="size-[22px] shrink-0" strokeWidth={active ? 2.2 : 1.9} aria-hidden />
                {active && <span className="truncate">{labels[key]}</span>}
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
