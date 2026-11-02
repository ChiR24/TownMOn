import { ArrowUpDown, Bug, Car, ChevronRight, Droplets, Hammer, MessageCircle, ShieldAlert, ShowerHead, Siren, Sparkles, Sprout, Volume2, Zap, type LucideIcon } from "lucide-react";
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

type Row = { id: number; description: string; category: string; status: string; urgency: string; createdAt: Date };

/** A complaint in the resident's lists. Their own words lead: the AI title is an English summary for the help desk. */
export function ComplaintRow({ c, t, lang }: { c: Row; t: T; lang: Lang }) {
  const emergency = c.urgency === "EMERGENCY";
  const Icon = emergency ? Siren : (ICONS[c.category] ?? MessageCircle);
  return (
    <Link href={`/complaints/${c.id}`} className={cx(cardCls, "press flex items-center gap-3 !p-3.5")}>
      <IconChip tone={emergency ? "red" : "zinc"}>
        <Icon className="size-5" aria-label={emergency ? "Emergency" : undefined} aria-hidden={!emergency} />
      </IconChip>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{c.description}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-ink-3">
          <ComplaintStatus status={c.status} t={t} />
          <span className="truncate">
            #{c.id} · {t(`cat.${c.category}` as Key)} · {relTime(c.createdAt, lang)}
          </span>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
    </Link>
  );
}
