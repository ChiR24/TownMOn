import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { rupees } from "@/lib/money";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const VARIANT = {
  primary: "bg-teal-700 text-white shadow-sm hover:bg-teal-800 active:bg-teal-900",
  secondary: "bg-white text-zinc-900 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 active:bg-zinc-100",
  soft: "bg-teal-50 text-teal-800 hover:bg-teal-100 active:bg-teal-200",
  ghost: "text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200",
  danger: "bg-red-700 text-white shadow-sm hover:bg-red-800",
} as const;
const SIZE = { sm: "h-9 rounded-lg px-3 text-sm", md: "h-12 rounded-xl px-4 text-[15px]", lg: "h-14 rounded-2xl px-6 text-base" } as const;
export type BtnProps = { variant?: keyof typeof VARIANT; size?: keyof typeof SIZE };

export const btn = ({ variant = "primary", size = "md" }: BtnProps = {}) =>
  cx(
    "inline-flex select-none items-center justify-center gap-2 font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:pointer-events-none disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
  );

export function Button({ variant, size, className, type = "button", ...p }: ComponentProps<"button"> & BtnProps) {
  return <button type={type} className={cx(btn({ variant, size }), className)} {...p} />;
}

export function LinkButton({ variant, size, className, ...p }: ComponentProps<typeof Link> & BtnProps) {
  return <Link className={cx(btn({ variant, size }), className)} {...p} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl bg-white p-4 ring-1 ring-zinc-200/80 sm:p-5", className)} {...p} />;
}

const TONE = {
  zinc: "bg-zinc-100 text-zinc-700",
  teal: "bg-teal-50 text-teal-800",
  sky: "bg-sky-50 text-sky-800",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  emerald: "bg-emerald-50 text-emerald-700",
  violet: "bg-violet-50 text-violet-700",
} as const;
export type Tone = keyof typeof TONE;

export function Badge({ tone = "zinc", className, ...p }: ComponentProps<"span"> & { tone?: Tone }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", TONE[tone], className)} {...p} />;
}

export const inputCls =
  "block w-full rounded-xl border-0 bg-white px-3.5 py-3 text-base text-zinc-900 ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-700 disabled:bg-zinc-50";

export function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-800">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function PageTitle({ title, subtitle, action, back }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-5">
      {back && (
        <Link href={back.href} className="-ml-1 mb-2 inline-flex items-center gap-1 rounded-lg px-1 py-1 text-sm text-zinc-500 hover:text-zinc-900">
          ← {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-zinc-500">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function Section({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("mt-7", className)}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 px-5 py-8 text-center">
      {icon && <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">{icon}</div>}
      <p className="text-[15px] font-medium text-zinc-700">{title}</p>
      {children && <div className="mt-1.5 text-sm text-zinc-500">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "zinc", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-relaxed", TONE[tone], className)} role={tone === "red" ? "alert" : undefined}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-zinc-200/70", className)} />;
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
  return <span className={cx("flex shrink-0 items-center justify-center rounded-full bg-teal-50 font-semibold text-teal-800", className ?? "size-10 text-sm")}>{initials || "?"}</span>;
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className ?? "size-8"}>
      <rect width="64" height="64" rx="16" fill="#0f766e" />
      <rect x="14" y="27" width="10" height="23" rx="2" fill="#fff" fillOpacity=".8" />
      <rect x="27" y="14" width="10" height="36" rx="2" fill="#fff" />
      <rect x="40" y="22" width="10" height="28" rx="2" fill="#fff" fillOpacity=".8" />
    </svg>
  );
}
