import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { rupees } from "@/lib/money";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// Colours are roles (see globals.css): near-black `cta` is the one primary action on a screen, lime `accent`
// highlights. Dark mode follows the device, on screen only (globals.css).
const lift = "shadow-[0_1px_2px_rgb(18_18_18/0.05),0_10px_24px_-14px_rgb(18_18_18/0.22)] dark:shadow-none dark:ring-1 dark:ring-line";
const VARIANT = {
  primary: "bg-cta text-cta-ink shadow-[0_12px_24px_-12px_rgb(18_18_18/0.55)] hover:opacity-90 dark:shadow-none",
  secondary: cx("bg-surface text-ink hover:bg-muted", lift),
  soft: "bg-accent-soft text-accent-ink hover:brightness-95 dark:hover:brightness-125",
  accent: "bg-accent text-[#121212] hover:brightness-95",
  ghost: "text-ink-2 hover:bg-muted",
  danger: "bg-red-600 text-white hover:bg-red-700",
} as const;
const SIZE = { sm: "h-9 px-4 text-sm", md: "h-12 px-5 text-[15px]", lg: "h-14 px-7 text-base" } as const;
export type BtnProps = { variant?: keyof typeof VARIANT; size?: keyof typeof SIZE };

export const btn = ({ variant = "primary", size = "md" }: BtnProps = {}) =>
  cx(
    "press inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-45",
    VARIANT[variant],
    SIZE[size],
  );

export function Button({ variant, size, className, type = "button", ...p }: ComponentProps<"button"> & BtnProps) {
  return <button type={type} className={cx(btn({ variant, size }), className)} {...p} />;
}

export function LinkButton({ variant, size, className, ...p }: ComponentProps<typeof Link> & BtnProps) {
  return <Link className={cx(btn({ variant, size }), className)} {...p} />;
}

/** A round icon button, as in the top corners of a screen. White with a soft lift, or glass on the floating bar. */
export function RoundLink({ href, label, glass, className, children }: { href: string; label: string; glass?: boolean; className?: string; children: ReactNode }) {
  return (
    <Link href={href} aria-label={label} title={label} className={cx("press relative flex size-11 shrink-0 items-center justify-center rounded-full text-ink", glass ? "glass" : cx("bg-surface", lift), className)}>
      {children}
    </Link>
  );
}

/** Content card: opaque, big radius, soft lift. Never glass (glass is for floating chrome). */
export const cardCls = "card p-5";

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx(cardCls, className)} {...p} />;
}

const TONE = {
  zinc: "bg-muted text-ink-2",
  brand: "bg-accent-soft text-accent-ink",
  sky: "bg-sky-50 text-sky-800 dark:bg-sky-400/12 dark:text-sky-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-400/12 dark:text-amber-300",
  red: "bg-red-50 text-red-700 dark:bg-red-400/12 dark:text-red-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-400/12 dark:text-violet-300",
  peach: "bg-orange-50 text-orange-800 dark:bg-orange-400/12 dark:text-orange-300",
} as const;
export type Tone = keyof typeof TONE;

export function Badge({ tone = "zinc", className, ...p }: ComponentProps<"span"> & { tone?: Tone }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none", TONE[tone], className)} {...p} />;
}

export const inputCls =
  "block w-full rounded-[20px] border-0 bg-surface px-4 py-3.5 text-base text-ink ring-1 ring-inset ring-line placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink disabled:bg-muted";

export function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block px-1 text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error?.trim() ? (
        <p className="px-1 text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="px-1 text-sm text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

/** Screen title: big and tight, with a round back button above it when the screen is a step down. */
export function PageTitle({ title, subtitle, action, back }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6">
      {back && (
        <RoundLink href={back.href} label={back.label} className="mb-5">
          <ArrowLeft className="size-5" aria-hidden />
        </RoundLink>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[15px] text-ink-3">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}

export function Section({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("mt-9", className)}>
      <div className="mb-3.5 flex items-center justify-between gap-3 px-1">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** "See all", as a small pill with an arrow. */
export function SeeAll({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={cx("press inline-flex items-center gap-1 rounded-full bg-surface py-1.5 pl-3 pr-2 text-xs font-semibold text-ink-2", lift)}>
      {children} <ArrowUpRight className="size-3.5" aria-hidden />
    </Link>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-dashed border-ink/12 px-5 py-9 text-center dark:border-line">
      {icon && <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">{icon}</div>}
      <p className="text-[15px] font-semibold text-ink-2">{title}</p>
      {children && <div className="mt-1.5 text-sm text-ink-3">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "zinc", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex gap-2.5 rounded-[22px] px-4 py-3.5 text-sm leading-relaxed", TONE[tone], className)} role={tone === "red" ? "alert" : undefined}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A soft round chip behind an icon: identity for list rows (category, kind) without loud colour. */
export function IconChip({ children, tone = "brand", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cx("flex size-11 shrink-0 items-center justify-center rounded-full", TONE[tone], className)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-[28px] bg-ink/8", className)} />;
}

export function Money({ paise, className }: { paise: number; className?: string }) {
  return <span className={cx("tabular-nums", className)}>{rupees(paise)}</span>;
}

// Pastel pairs for initials, picked by name so a person keeps their colour everywhere.
const AVATAR = ["bg-[#e7f6c6] text-[#3b6b0e]", "bg-[#fde2cc] text-[#8a4513]", "bg-[#e6e0fa] text-[#4b3a99]", "bg-[#d8edf9] text-[#155e86]", "bg-[#f6eac0] text-[#6f520a]"];

/** Initials avatar, used where a person has no photo. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const clean = name.replace(/\(.*?\)/g, "").trim();
  const initials = clean
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const hue = [...clean].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR.length;
  return <span className={cx("flex shrink-0 items-center justify-center rounded-full font-semibold", AVATAR[hue], className ?? "size-10 text-sm")}>{initials || "?"}</span>;
}
