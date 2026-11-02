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

const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const monthFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });

export const fmtDate = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`));
export const fmtMonth = (period: string) => monthFmt.format(new Date(`${period}-01T00:00:00Z`));
export const fmtTime = (d: Date) => timeFmt.format(d);
export const fmtDateTime = (d: Date) => dateTimeFmt.format(d);

/** "5 min ago", "3 h ago", "2 days ago" */
export function ago(d: Date, now = new Date()) {
  const min = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
