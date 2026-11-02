import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./ui";

/** A slim progress bar. On the dark hero card pass `onDark`. Value is a fraction from 0 to 1. */
export function ProgressBar({ value, onDark, className, label }: { value: number; onDark?: boolean; className?: string; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className={cx("h-2 overflow-hidden rounded-full", onDark ? "bg-white/15" : "bg-muted", className)}>
      <div className={cx("h-full rounded-full", onDark ? "bg-accent" : "bg-ink")} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * A half-circle gauge for one rate against its target (the committee's success measures). The arc is the value, the
 * tick is the target, and the number and words carry the meaning, so colour is never the only signal. `max` sets the
 * full scale, so a small rate (reopened complaints, target under 8%) isn't a sliver.
 */
export function Gauge({ value, target, label, note, lowerIsBetter, max = 100 }: { value: number | null; target: number; label: string; note: ReactNode; lowerIsBetter?: boolean; max?: number }) {
  const r = 80;
  const at = (pct: number) => {
    const a = Math.PI * (1 - Math.min(max, Math.max(0, pct)) / max);
    return [100 + r * Math.cos(a), 100 - r * Math.sin(a)] as const;
  };
  const arc = (to: number) => {
    const [x, y] = at(to);
    return `M ${100 - r} 100 A ${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
  };
  const met = value != null && (lowerIsBetter ? value <= target : value >= target);
  const [tx, ty] = at(target);
  const [ix, iy] = [100 + (tx - 100) * 0.78, 100 + (ty - 100) * 0.78];
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 200 112" className="w-full max-w-[220px]" role="img" aria-label={`${label}: ${value ?? "no data"}${value == null ? "" : "%"}, target ${lowerIsBetter ? "under" : "at least"} ${target}%`}>
        <path d={arc(max)} fill="none" stroke="currentColor" className="text-muted" strokeWidth="18" strokeLinecap="round" />
        {value != null && value > 0 && <path d={arc(value)} fill="none" stroke="currentColor" className={met ? "text-accent-ink" : "text-ink"} strokeWidth="18" strokeLinecap="round" />}
        <line x1={ix} y1={iy} x2={tx + (tx - 100) * 0.16} y2={ty + (ty - 100) * 0.16} stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
        <text x="100" y="92" textAnchor="middle" className="fill-ink text-[30px] font-semibold tabular-nums">
          {value == null ? "—" : `${value}%`}
        </text>
      </svg>
      <figcaption className="mt-1 text-center">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-xs text-ink-3">{note}</span>
      </figcaption>
    </figure>
  );
}

/** Where something stands, as a row of steps: done (filled), now (lime ring), still to come (grey). */
export function Steps({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <ol className="flex items-start" aria-label={label}>
      {steps.map((s, i) => {
        const done = i < current || current === steps.length - 1;
        const now = i === current && current !== steps.length - 1;
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center text-center" aria-current={now ? "step" : undefined}>
            {i > 0 && <span className={cx("absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2", i <= current ? "bg-ink" : "bg-ink/12")} aria-hidden />}
            <span
              className={cx(
                "relative z-10 flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                done ? "bg-ink text-canvas" : now ? "bg-accent text-[#121212] ring-4 ring-accent/30" : "bg-muted text-ink-3",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={cx("mt-2 px-0.5 text-[11px] leading-tight", now ? "font-semibold text-ink" : "text-ink-3")}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}
