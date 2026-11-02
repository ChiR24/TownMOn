"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function StaffNav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  // The most specific link that matches wins, so "/accounts/review" doesn't also light up "/accounts".
  const active = links.map((l) => l.href).filter((h) => path === h || path.startsWith(`${h}/`)).sort((a, b) => b.length - a.length)[0];
  return (
    <nav className="-mx-1 flex min-w-0 gap-1 overflow-x-auto" aria-label="Staff">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.href === active ? "page" : undefined}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${l.href === active ? "bg-teal-50 text-teal-800" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
