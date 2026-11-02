// Resident and gate screens in English, Marathi and Hindi. Staff consoles are English (assumption in the TDD).
import { en, type Dict, type Key } from "./en";
import { hi } from "./hi";
import { mr } from "./mr";

export type { Key };

export const LANGS = { en: "English", mr: "मराठी", hi: "हिंदी" } as const;
export type Lang = keyof typeof LANGS;
export const isLang = (x: unknown): x is Lang => typeof x === "string" && x in LANGS;

const DICTS: Record<Lang, Dict> = { en, mr, hi };

export function translator(lang: Lang) {
  const d = DICTS[lang] ?? en;
  return (key: Key, vars?: Record<string, string | number>) => {
    // A key missing from a language falls back to English, then to the key itself, so a screen never crashes on it.
    const s = (d[key] ?? en[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars?.[k] ?? `{${k}}`));
    // English singulars: "1 days overdue" reads "1 day overdue". Marathi and Hindi use one word for both.
    return d === en ? s.replace(/\b1 (day|hour|minute)s\b/g, "1 $1") : s;
  };
}
export type T = ReturnType<typeof translator>;
