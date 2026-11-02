// Shared by every seed step: deterministic randomness, "now", and a chunked insert helper.
import { crc32, deflateSync } from "node:zlib";
import { shiftPeriod, todayIST } from "../../lib/dates";

// A fixed seed, so every run builds the same township (relative to today).
let state = 20261102;
export function rand() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
export const chance = (p: number) => rand() < p;
export const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
export const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export const now = new Date();
export const today = todayIST(now);
export const PERIOD = today.slice(0, 7);
export const PERIODS = [-3, -2, -1, 0].map((n) => shiftPeriod(PERIOD, n));
export const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:30`);
export const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
export const later = (d: Date, minutes: number) => new Date(Math.min(d.getTime() + minutes * 60_000, now.getTime()));
export const nextDueDate = (date: string) => (Number(date.slice(8)) <= 15 ? `${date.slice(0, 8)}15` : `${shiftPeriod(date.slice(0, 7), 1)}-15`);

export async function chunked<T, R>(rows: T[], insert: (part: T[]) => Promise<R[]>, size = 800): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < rows.length; i += size) out.push(...(await insert(rows.slice(i, i + size))));
  return out;
}

/** A small grey PNG standing in for old visitor photos (so the 90-day purge has something to delete). */
export function placeholderPhoto(size = 64) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit greyscale
  const raw = Buffer.alloc((size + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) raw[y * (size + 1) + 1 + x] = Math.min(230, 90 + Math.round((140 * Math.hypot(x - size / 2, y - size / 2.6)) / size));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
