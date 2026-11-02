import { ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./ui";

/*
 * The AI's visual signature: a violet sparkle. Used only where Claude actually decided something (a complaint's
 * category, urgency, title or duplicate link), never for rules or staff decisions, so people can always tell
 * which calls a machine made and check them.
 */

/** "AI 94%" — how sure the model was. Amber when it was unsure and a person should look. */
export function AiBadge({ confidence, unsure, className }: { confidence: number | null; unsure?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
        unsure ? "bg-amber-50 text-amber-800 dark:bg-amber-400/12 dark:text-amber-300" : "bg-violet-50 text-violet-700 dark:bg-violet-400/12 dark:text-violet-300",
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden /> AI{confidence != null ? ` ${confidence}%` : ""}
    </span>
  );
}

/** The sparkle in its gradient circle. */
function AiMark({ className }: { className?: string }) {
  return (
    <span className={cx("ai-grad flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-[0_8px_20px_-8px_rgb(109_93_252/0.7)]", className)}>
      <Sparkles className="size-5" aria-hidden />
    </span>
  );
}

/** A short note from the AI (or about it), as a soft violet card. Links when there is somewhere to act on it. */
export function AiNote({ title, children, href, className }: { title: ReactNode; children?: ReactNode; href?: string; className?: string }) {
  const body = (
    <>
      <AiMark />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {children && <div className="mt-0.5 text-sm leading-relaxed text-ink-2">{children}</div>}
      </div>
      {href && <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />}
    </>
  );
  const cls = cx("ai-soft flex items-center gap-3.5 rounded-[24px] p-4", className);
  return href ? (
    <Link href={href} className={cx(cls, "press")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
