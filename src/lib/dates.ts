// Business dates are 'YYYY-MM-DD' strings in India time; maths is done on whole days.
export const TZ = "Asia/Kolkata";
const DAY_MS = 86_400_000;
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const todayIST = (now = new Date()) => ymd.format(now);
export const dayNum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY_MS;
export const addDays = (d: string, n: number) => new Date((dayNum(d) + n) * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => dayNum(to) - dayNum(from);

/** '2026-11' shifted by n months. */
export function shiftPeriod(period: string, n: number) {
  const [y, m] = period.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

// Formatters per language, always with Latin digits so dates read the same as amounts (₹ uses Latin digits).
const cache = new Map<string, Intl.DateTimeFormat>();
function dtf(lang: string, key: string, opts: Intl.DateTimeFormatOptions) {
  const k = `${lang}|${key}`;
  let f = cache.get(k);
  if (!f) cache.set(k, (f = new Intl.DateTimeFormat(`${lang}-IN-u-nu-latn`, opts)));
  return f;
}

export const fmtDate = (d: string, lang = "en") => dtf(lang, "date", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T00:00:00Z`));
const dayFmt = (lang: string) => dtf(lang, "day", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
export const fmtDay = (d: string, lang = "en") => dayFmt(lang).format(new Date(`${d}T00:00:00Z`));
/** The pieces of fmtDay ("Mon", "2", "Nov"), for date chips. */
export const dayParts = (d: string, lang = "en") =>
  Object.fromEntries(dayFmt(lang).formatToParts(new Date(`${d}T00:00:00Z`)).map((p) => [p.type, p.value])) as Record<"weekday" | "day" | "month", string>;
export const fmtLongDate = (d: string, lang = "en") => dtf(lang, "long", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${d}T00:00:00Z`));
export const fmtMonth = (period: string, lang = "en") => dtf(lang, "month", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${period}-01T00:00:00Z`));
export const fmtTime = (d: Date, lang = "en") => dtf(lang, "time", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d);
export const fmtDateTime = (d: Date, lang = "en") => dtf(lang, "dt", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(d);

/** "5 minutes ago" / "५ मिनिटांपूर्वी"-style relative time, in the reader's language (Latin digits). */
export function relTime(d: Date, lang = "en", now = new Date()) {
  const rtf = new Intl.RelativeTimeFormat(`${lang}-IN-u-nu-latn`, { numeric: "auto" });
  const min = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return rtf.format(h, "hour");
  return rtf.format(Math.round(h / 24), "day");
}

/** A moment n days before now (kept out of components so renders stay pure). */
export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Midnight today in India time, as a Date. */
export const startOfTodayIST = (now = new Date()) => new Date(`${todayIST(now)}T00:00:00+05:30`);
