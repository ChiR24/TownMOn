"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function StaffNav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  // The most specific link that matches wins, so "/accounts/review" doesn't also light up "/accounts".
  const active = links.map((l) => l.href).filter((h) => path === h || path.startsWith(`${h}/`)).sort((a, b) => b.length - a.length)[0];
  return (
    <nav className="-mx-1 flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Staff">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.href === active ? "page" : undefined}
          className={`press whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${l.href === active ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-muted hover:text-ink"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
