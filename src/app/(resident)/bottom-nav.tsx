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

/** A floating glass tab bar: the navigation layer sits above content, content scrolls beneath it. */
export function BottomNav({ labels }: { labels: Record<(typeof ITEMS)[number]["key"], string> }) {
  const path = usePathname();
  return (
    <nav className="edge-bottom no-print fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]" aria-label="Main">
      <ul className="glass mx-auto grid max-w-md grid-cols-5 gap-1 rounded-[28px] p-1.5">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href) || (key === "more" && path.startsWith("/amenities"));
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`press flex h-14 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[11px] font-semibold transition-colors ${
                  active ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:text-ink"
                }`}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                {labels[key]}
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
