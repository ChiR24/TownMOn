import Link from "next/link";
import { switchFlat } from "@/app/actions";
import { Logo } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { getT } from "@/lib/lang";
import { BottomNav } from "./bottom-nav";

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const { flat, flats } = await requireResident();
  const t = await getT();
  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-stone-50/90 px-4 pb-2 pt-3 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 rounded-lg" aria-label="Home">
          <Logo className="size-8" />
          <span className="font-semibold tracking-tight">Township</span>
        </Link>
        {flats.length > 1 ? (
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-zinc-200">
              {flat.flatId} <span aria-hidden>▾</span>
            </summary>
            <div className="absolute right-0 mt-2 w-40 rounded-xl bg-white p-1 shadow-lg ring-1 ring-zinc-200">
              {flats.map((f) => (
                <form key={f.flatId} action={switchFlat.bind(null, f.flatId)}>
                  <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50">{f.flatId}</button>
                </form>
              ))}
            </div>
          </details>
        ) : (
          <span className="rounded-full bg-white px-3 py-1.5 text-sm font-medium tabular-nums ring-1 ring-zinc-200">{flat.flatId}</span>
        )}
      </header>
      <main className="px-4 pb-28 pt-2">{children}</main>
      <BottomNav labels={{ home: t("nav.home"), bills: t("nav.bills"), complaints: t("nav.complaints"), visitors: t("nav.visitors"), more: t("nav.more") }} />
    </div>
  );
}
