import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { switchFlat } from "@/app/actions";
import { Logo } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { getT } from "@/lib/lang";
import { BottomNav, PageEnter } from "./bottom-nav";

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const { flat, flats } = await requireResident();
  const t = await getT();
  const chip = "glass press flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-semibold tabular-nums text-ink";
  return (
    <div className="theme-auto resident-backdrop min-h-dvh text-ink">
      <div className="mx-auto max-w-lg">
        <header className="edge-top sticky top-0 z-20 flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <Link href="/" className="glass press flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5" aria-label="Home">
            <Logo className="size-8" />
            <span className="font-bold">Township</span>
          </Link>
          {flats.length > 1 ? (
            <details className="relative">
              <summary className={`${chip} cursor-pointer list-none`}>
                {flat.flatId} <ChevronDown className="size-4 text-ink-3" aria-hidden />
              </summary>
              <div className="glass absolute right-0 mt-2 w-44 rounded-2xl p-1.5">
                {flats.map((f) => (
                  <form key={f.flatId} action={switchFlat.bind(null, f.flatId)}>
                    <button className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-muted">{f.flatId}</button>
                  </form>
                ))}
              </div>
            </details>
          ) : (
            <span className={chip}>{flat.flatId}</span>
          )}
        </header>
        <main className="px-4 pb-36 pt-2">
          <PageEnter>{children}</PageEnter>
        </main>
        <BottomNav labels={{ home: t("nav.home"), bills: t("nav.bills"), complaints: t("nav.complaints"), visitors: t("nav.visitors"), more: t("nav.more") }} />
      </div>
    </div>
  );
}
