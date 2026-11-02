import { and, count, eq, isNull, ne } from "drizzle-orm";
import { Bell, ChevronDown } from "lucide-react";
import Link from "next/link";
import { switchFlat } from "@/app/actions";
import { AppSidebar } from "@/components/app-sidebar";
import { Logo } from "@/components/brand";
import { BottomNav, PageEnter, type NavLink } from "@/components/nav";
import { RoundLink } from "@/components/ui";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { getT } from "@/lib/lang";

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const { user, flat, flats } = await requireResident();
  const t = await getT();
  // Unread updates (complaints, gate, notices) light the bell; sign-in SMS receipts don't.
  const [{ unread }] = await db
    .select({ unread: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt), ne(notifications.channel, "SMS")));
  const chip = "glass press flex h-11 items-center gap-1 rounded-full px-4 text-sm font-semibold tabular-nums text-ink";
  const links: NavLink[] = [
    { href: "/", label: t("nav.home"), icon: "home" },
    { href: "/bills", label: t("nav.bills"), icon: "bills" },
    { href: "/complaints", label: t("nav.complaints"), icon: "complaints" },
    { href: "/visitors", label: t("nav.visitors"), icon: "visitors" },
    { href: "/more", label: t("nav.more"), icon: "more", also: ["/amenities"] },
  ];
  // One layout for every screen: tab bar and a single column on phones, a wider column from tablets, and on
  // computers the same sidebar the staff screens use.
  return (
    <div className="app-backdrop min-h-dvh text-ink lg:flex lg:gap-5 lg:p-4">
      <AppSidebar home="/" links={links} navLabel="Main" name={user.name} subtitle={flat.flatId} signOutLabel={t("m.signOut")} />
      <div className="mx-auto w-full min-w-0 max-w-lg md:max-w-3xl">
        <header className="edge-top sticky top-0 z-20 flex items-center gap-2 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <Link href="/" className="glass press flex size-11 items-center justify-center rounded-full lg:hidden" aria-label={t("nav.home")}>
            <Logo className="size-7" />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {flats.length > 1 ? (
              <details className="relative">
                <summary className={`${chip} cursor-pointer list-none`}>
                  {flat.flatId} <ChevronDown className="size-4 text-ink-3" aria-hidden />
                </summary>
                <div className="glass absolute right-0 mt-2 w-44 rounded-[22px] p-1.5">
                  {flats.map((f) => (
                    <form key={f.flatId} action={switchFlat.bind(null, f.flatId)}>
                      <button className="w-full rounded-2xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted" aria-current={f.flatId === flat.flatId ? "true" : undefined}>
                        {f.flatId}
                      </button>
                    </form>
                  ))}
                </div>
              </details>
            ) : (
              <span className={chip}>{flat.flatId}</span>
            )}
            <RoundLink href="/more#messages" label={unread ? `${t("m.messages")}: ${unread}` : t("m.messages")} glass>
              <Bell className="size-5" aria-hidden />
              {unread > 0 && <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-red-500 ring-2 ring-surface" aria-hidden />}
            </RoundLink>
          </div>
        </header>
        <main className="px-4 pb-36 pt-3 lg:pb-12">
          <PageEnter>{children}</PageEnter>
        </main>
        <BottomNav links={links} label="Main" />
      </div>
    </div>
  );
}
