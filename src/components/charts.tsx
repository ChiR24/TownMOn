import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./ui";

// Plain HTML/CSS charts: server-rendered, no chart library, tooltips on hover and keyboard focus.
// Colours validated with the dataviz palette checks (ordinal teal ramp; status colours never alone).

export const STATUS_COLOR = { good: "#0ca30c", warning: "#fab219", critical: "#d03b3b" } as const;
export type Status = keyof typeof STATUS_COLOR;

/** Status = an icon in the status colour + words in ordinary ink. Never colour alone. */
export function StatusNote({ status, children }: { status: Status; children: ReactNode }) {
  const Icon = status === "good" ? CircleCheck : status === "warning" ? CircleAlert : TriangleAlert;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
      <Icon className="size-3.5 shrink-0" style={{ color: STATUS_COLOR[status] }} aria-hidden />
      {children}
    </span>
  );
}

export function StatTile({ label, value, note, href }: { label: string; value: ReactNode; note?: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-zinc-950">{value}</p>
      {note && <div className="mt-1.5">{note}</div>}
    </>
  );
  const cls = "block rounded-2xl bg-white p-4 ring-1 ring-zinc-200/80";
  return href ? (
    <a href={href} className={cx(cls, "hover:ring-teal-700")}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A single ratio against a whole: fill and track from the same teal ramp. */
export function Meter({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label} className="h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#ccfbf1" }}>
      <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: "#0f766e" }} />
    </div>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 shadow-lg group-hover:block group-focus-visible:block">
      {children}
    </span>
  );
}

/** Columns for a percentage over time, with a target line. One series: no legend, the title names it. */
export function PercentColumns({ data, target, targetLabel }: { data: { label: string; value: number; detail: string }[]; target: number; targetLabel: string }) {
  return (
    <div>
      <div className="relative ml-9 h-48">
        {[0, 25, 50, 75, 100].map((v) => (
          <div key={v} className="absolute inset-x-0 border-t border-zinc-200" style={{ bottom: `${v}%` }}>
            <span className="absolute -left-9 -top-2 w-7 text-right text-[11px] tabular-nums text-zinc-400">{v}%</span>
          </div>
        ))}
        <div className="absolute inset-x-0 border-t border-zinc-500" style={{ bottom: `${target}%` }}>
          <span className="absolute -top-5 right-0 bg-white pl-1 text-[11px] font-medium text-zinc-600">{targetLabel}</span>
        </div>
        <div className="absolute inset-0 flex items-end justify-around">
          {data.map((d) => (
            <div key={d.label} tabIndex={0} className="group relative flex h-full w-14 flex-col items-center justify-end outline-none" aria-label={`${d.label}: ${d.value}%`}>
              <span className="mb-1 text-xs font-semibold text-zinc-800">{d.value}%</span>
              <div className="w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-teal-700" style={{ height: `${d.value}%`, backgroundColor: "#0f766e" }} />
              <Tip>
                <span className="block text-sm font-semibold text-white">{d.value}%</span>
                {d.detail}
              </Tip>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-9 mt-2 flex justify-around text-xs text-zinc-500">
        {data.map((d) => (
          <span key={d.label} className="w-14 text-center">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Overdue buckets step darker with age (validated ordinal ramp: one hue, monotone, adjacent ΔL ≥ 0.06).
const AGEING_FILL = ["#14b8a6", "#0d9488", "#0f766e", "#134e4a"];

/** Horizontal bars for the overdue buckets, value at the tip. Hover or focus a bar for its share. */
export function AgeingBars({ rows, format }: { rows: { label: string; amount: number; flats: number }[]; format: (paise: number) => string }) {
  const max = Math.max(...rows.map((r) => r.amount), 1);
  const total = rows.reduce((a, r) => a + r.amount, 0) || 1;
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label} className="grid grid-cols-[96px_1fr] items-center gap-3">
          <span className="text-sm text-zinc-600">{r.label}</span>
          <div tabIndex={0} className="group relative flex items-center gap-2 outline-none" aria-label={`${r.label}: ${format(r.amount)}, ${r.flats} flats`}>
            <div
              className="h-5 min-w-[3px] rounded-r-[4px] transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-teal-700"
              style={{ width: `${(78 * r.amount) / max}%`, backgroundColor: AGEING_FILL[i] }}
            />
            <span className="whitespace-nowrap text-xs text-zinc-700">
              <span className="font-semibold text-zinc-900">{format(r.amount)}</span> · {r.flats.toLocaleString("en-IN")} flats
            </span>
            <Tip>
              <span className="block text-sm font-semibold text-white">{format(r.amount)}</span>
              {Math.round((100 * r.amount) / total)}% of all dues · {r.flats.toLocaleString("en-IN")} flats
            </Tip>
          </div>
        </li>
      ))}
    </ul>
  );
}
