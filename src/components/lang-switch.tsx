import { setLang } from "@/app/actions";
import { LANGS, type Lang } from "@/lib/i18n";
import { cx } from "./ui";

/** Three plain forms: works without JavaScript, which matters on slow phones. */
export function LangSwitch({ current, className }: { current: Lang; className?: string }) {
  return (
    <div className={cx("inline-flex rounded-xl bg-zinc-100 p-1", className)} role="group" aria-label="Language">
      {(Object.keys(LANGS) as Lang[]).map((l) => (
        <form key={l} action={setLang.bind(null, l)}>
          <button
            type="submit"
            lang={l}
            aria-pressed={l === current}
            className={cx("h-9 rounded-lg px-3 text-sm font-medium transition-colors", l === current ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900")}
          >
            {LANGS[l]}
          </button>
        </form>
      ))}
    </div>
  );
}
