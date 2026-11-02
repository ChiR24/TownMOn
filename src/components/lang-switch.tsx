import { setLang } from "@/app/actions";
import { LANGS, type Lang } from "@/lib/i18n";
import { cx } from "./ui";

/** Three plain forms: works without JavaScript, which matters on slow phones. */
export function LangSwitch({ current, className }: { current: Lang; className?: string }) {
  return (
    <div className={cx("inline-flex rounded-full bg-surface p-1 shadow-[0_1px_2px_rgb(18_18_18/0.05),0_10px_24px_-14px_rgb(18_18_18/0.22)] dark:ring-1 dark:ring-line", className)} role="group" aria-label="Language">
      {(Object.keys(LANGS) as Lang[]).map((l) => (
        <form key={l} action={setLang.bind(null, l)}>
          <button
            type="submit"
            lang={l}
            aria-pressed={l === current}
            className={cx("press h-10 rounded-full px-4 text-sm font-semibold transition-colors", l === current ? "bg-cta text-cta-ink" : "text-ink-3 hover:text-ink")}
          >
            {LANGS[l]}
          </button>
        </form>
      ))}
    </div>
  );
}
