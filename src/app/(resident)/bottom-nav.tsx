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

export function BottomNav({ labels }: { labels: Record<(typeof ITEMS)[number]["key"], string> }) {
  const path = usePathname();
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href) || (key === "more" && path.startsWith("/amenities"));
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-teal-800" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                {labels[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
