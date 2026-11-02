import { SubmitButton } from "@/components/submit-button";
import { Avatar } from "@/components/ui";
import { relTime } from "@/lib/dates";
import type { Key, T } from "@/lib/i18n";
import { decideVisitor } from "./visitors/actions";

type Visitor = { id: number; name: string; purpose: string; gate: number; photoId: number | null; arrivedAt: Date };

/** Someone at the gate for this flat: the most time-critical thing in the app, so it leads Home and Visitors. */
export function GateRequest({ v, t, lang }: { v: Visitor; t: T; lang: string }) {
  return (
    <section className="rounded-[28px] bg-amber-50 p-4 ring-1 ring-amber-200/80 dark:bg-amber-400/10 dark:ring-amber-300/20" aria-live="polite">
      <div className="flex items-center gap-3.5">
        {v.photoId ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, access-checked photo route
          <img src={`/api/photos/${v.photoId}`} alt="" className="size-16 shrink-0 rounded-[20px] object-cover" />
        ) : (
          <Avatar name={v.name} className="size-16 rounded-[20px] text-lg" />
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-amber-500 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
            </span>
            {t("v.waiting")}
          </p>
          <p className="mt-0.5 text-[17px] font-semibold leading-snug">{t("home.atGate", { name: v.name, gate: v.gate })}</p>
          <p className="text-sm text-ink-2">
            {t(`v.purpose.${v.purpose}` as Key)} · {relTime(v.arrivedAt, lang)}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <form action={decideVisitor.bind(null, v.id, "APPROVED")}>
          <SubmitButton className="w-full">{t("home.letIn")}</SubmitButton>
        </form>
        <form action={decideVisitor.bind(null, v.id, "DENIED")}>
          <SubmitButton variant="secondary" className="w-full">
            {t("home.deny")}
          </SubmitButton>
        </form>
      </div>
    </section>
  );
}
