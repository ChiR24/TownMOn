import { ArrowUpDown, Bug, Car, Droplets, Hammer, MessageCircle, ShieldAlert, ShowerHead, Siren, Sparkles, Sprout, Volume2, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { relTime } from "@/lib/dates";
import type { Key, Lang, T } from "@/lib/i18n";
import { ComplaintStatus } from "./badges";
import { cardCls, cx, IconChip } from "./ui";

// One icon per category, so a list can be scanned without reading every word.
const ICONS: Record<string, LucideIcon> = {
  Plumbing: Droplets,
  Electrical: Zap,
  Lift: ArrowUpDown,
  "Water supply": ShowerHead,
  Cleaning: Sparkles,
  Security: ShieldAlert,
  Parking: Car,
  Noise: Volume2,
  "Pest control": Bug,
  Civil: Hammer,
  Garden: Sprout,
  Other: MessageCircle,
};

/** The five stages a complaint moves through, in order. The resident always sees which one it is at. */
export const STAGES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

type Row = { id: number; description: string; category: string; status: string; urgency: string; createdAt: Date };

/** A complaint in the resident's lists. Their own words lead: the AI title is an English summary for the help desk. */
export function ComplaintRow({ c, t, lang }: { c: Row; t: T; lang: Lang }) {
  const emergency = c.urgency === "EMERGENCY";
  const Icon = emergency ? Siren : (ICONS[c.category] ?? MessageCircle);
  const stage = STAGES.indexOf(c.status as (typeof STAGES)[number]);
  return (
    <Link href={`/complaints/${c.id}`} className={cx(cardCls, "press flex items-center gap-3.5 !p-4")}>
      <IconChip tone={emergency ? "red" : "zinc"} className="size-12 self-start">
        <Icon className="size-5" aria-label={emergency ? "Emergency" : undefined} aria-hidden={!emergency} />
      </IconChip>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{c.description}</p>
        <p className="mt-0.5 truncate text-xs text-ink-3">
          #{c.id} · {t(`cat.${c.category}` as Key)} · {relTime(c.createdAt, lang)}
        </p>
        <div className="mt-3 flex items-center gap-2.5">
          <div className="flex flex-1 gap-1" aria-hidden>
            {STAGES.map((s, i) => (
              <span key={s} className={cx("h-1.5 flex-1 rounded-full", i <= stage ? (i === stage && stage < 4 ? "bg-accent-ink" : "bg-ink") : "bg-ink/10")} />
            ))}
          </div>
          <ComplaintStatus status={c.status} t={t} />
        </div>
      </div>
    </Link>
  );
}
