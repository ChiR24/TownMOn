import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { rupees } from "@/lib/money";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// Colours are roles (see globals.css): surface, ink, line, accent. Dark mode only applies inside `.theme-auto`.
const VARIANT = {
  primary: "bg-accent text-white shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_6px_16px_-6px_rgb(15_110_99/0.55)] hover:brightness-110",
  secondary: "bg-surface text-ink ring-1 ring-inset ring-line shadow-sm hover:bg-muted",
  soft: "bg-accent-soft text-accent-ink hover:brightness-95 dark:hover:brightness-125",
  ghost: "text-ink-2 hover:bg-muted",
  danger: "bg-red-700 text-white shadow-sm hover:bg-red-800",
} as const;
const SIZE = { sm: "h-9 rounded-xl px-3 text-sm", md: "h-12 rounded-2xl px-4 text-[15px]", lg: "h-14 rounded-2xl px-6 text-base" } as const;
export type BtnProps = { variant?: keyof typeof VARIANT; size?: keyof typeof SIZE };

export const btn = ({ variant = "primary", size = "md" }: BtnProps = {}) =>
  cx(
    "press inline-flex select-none items-center justify-center gap-2 font-semibold",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-45",
    VARIANT[variant],
    SIZE[size],
  );

export function Button({ variant, size, className, type = "button", ...p }: ComponentProps<"button"> & BtnProps) {
  return <button type={type} className={cx(btn({ variant, size }), className)} {...p} />;
}

export function LinkButton({ variant, size, className, ...p }: ComponentProps<typeof Link> & BtnProps) {
  return <Link className={cx(btn({ variant, size }), className)} {...p} />;
}

/** Content card: an opaque surface with a hairline and a soft lift. Never glass (glass is for floating chrome). */
export const cardCls = "card p-4 sm:p-5";

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx(cardCls, className)} {...p} />;
}

const TONE = {
  zinc: "bg-muted text-ink-2",
  teal: "bg-accent-soft text-accent-ink",
  sky: "bg-sky-50 text-sky-800 dark:bg-sky-400/12 dark:text-sky-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-400/12 dark:text-amber-300",
  red: "bg-red-50 text-red-700 dark:bg-red-400/12 dark:text-red-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-400/12 dark:text-violet-300",
} as const;
export type Tone = keyof typeof TONE;

export function Badge({ tone = "zinc", className, ...p }: ComponentProps<"span"> & { tone?: Tone }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[tone], className)} {...p} />;
}

export const inputCls =
  "block w-full rounded-2xl border-0 bg-surface px-4 py-3 text-base text-ink shadow-sm ring-1 ring-inset ring-line placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-muted dark:shadow-none";

export function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error?.trim() ? (
        <p className="text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function PageTitle({ title, subtitle, action, back }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-5">
      {back && (
        <Link href={back.href} className="press -ml-2 mb-1 inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-sm font-medium text-ink-3 hover:text-ink">
          <span aria-hidden>‹</span> {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-ink-3">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function Section({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("mt-8", className)}>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <h2 className="text-[17px] font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line px-5 py-8 text-center">
      {icon && <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">{icon}</div>}
      <p className="text-[15px] font-semibold text-ink-2">{title}</p>
      {children && <div className="mt-1.5 text-sm text-ink-3">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "zinc", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex gap-2.5 rounded-2xl px-4 py-3 text-sm leading-relaxed", TONE[tone], className)} role={tone === "red" ? "alert" : undefined}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A soft round chip behind an icon: identity for list rows (category, kind) without loud colour. */
export function IconChip({ children, tone = "teal", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-2xl", TONE[tone], className)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-2xl bg-ink/8", className)} />;
}

export function Money({ paise, className }: { paise: number; className?: string }) {
  return <span className={cx("tabular-nums", className)}>{rupees(paise)}</span>;
}

/** Initials avatar, used where a person has no photo. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return <span className={cx("flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-bold text-accent-ink", className ?? "size-10 text-sm")}>{initials || "?"}</span>;
}

const TOWERS = [
  [6, 34, 70],
  [44, 28, 98],
  [76, 40, 58],
  [120, 30, 112],
  [154, 44, 78],
  [202, 32, 102],
  [238, 38, 66],
  [280, 28, 92],
  [312, 42, 74],
  [358, 34, 106],
] as const;

/** A dusk skyline for the sign-in header: the township's towers with a few lit windows. */
export function Skyline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" aria-hidden className={className}>
      <defs>
        <pattern id="skyline-windows" width="8" height="11" patternUnits="userSpaceOnUse">
          <rect x="2" y="3" width="3" height="4" rx="0.6" fill="#f6c453" />
        </pattern>
      </defs>
      {TOWERS.map(([x, w, h], i) => (
        <g key={x}>
          <rect x={x} y={120 - h} width={w} height={h + 4} rx="3" fill="#fff" fillOpacity={i % 2 ? 0.09 : 0.06} />
          <rect x={x + 4} y={128 - h} width={w - 8} height={h - 16} fill="url(#skyline-windows)" opacity={i % 3 === 0 ? 0.55 : 0.28} />
        </g>
      ))}
    </svg>
  );
}

/** The mark: three towers at dawn. Same drawing as app/icon.svg and the PNG app icons. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className ?? "size-8"}>
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14897b" />
          <stop offset="1" stopColor="#0a4b43" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#logo-bg)" />
      <circle cx="46" cy="18" r="5" fill="#f6c453" />
      <rect x="13" y="29" width="11" height="21" rx="2.5" fill="#fff" fillOpacity=".78" />
      <rect x="27" y="17" width="11" height="33" rx="2.5" fill="#fff" />
      <rect x="41" y="31" width="11" height="19" rx="2.5" fill="#fff" fillOpacity=".78" />
      <rect x="10" y="50" width="44" height="3" rx="1.5" fill="#fff" fillOpacity=".9" />
    </svg>
  );
}
