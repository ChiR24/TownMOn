// Reading a bank statement CSV exported from net banking: whatever the bank's column names and date format.

type StatementRow = { line: number; date: string; narration: string; ref: string; debit: number; credit: number; balance: number | null };

/** RFC-4180-ish CSV: quoted cells, doubled quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (s[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim()));
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** dd/mm/yy, dd-mm-yyyy, yyyy-mm-dd or 02-Nov-2026 -> 'YYYY-MM-DD' (Indian banks put the day first). */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: string | number, m: string | number, d: string | number;
  let match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) [, y, m, d] = match;
  else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) [, d, m, y] = match;
  else if ((match = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s,-]+(\d{2}|\d{4})$/))) {
    [, d, , y] = match;
    m = MONTHS[match[2].toLowerCase()];
  } else return null;
  const year = String(y).length === 2 ? 2000 + Number(y) : Number(y);
  const date = new Date(Date.UTC(year, Number(m) - 1, Number(d)));
  if (!m || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null;
  return date.toISOString().slice(0, 10);
}

/** "7,475.00" / "₹ 7475" / "" -> paise. NaN for junk. */
export function parseAmount(raw: string): number {
  const t = raw.replace(/₹|INR|Rs\.?|,|\s/gi, "").replace(/(CR|DR)$/i, "");
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Finds the header row by name (banks add preamble lines) and reads every dated row under it. */
export function readStatement(text: string): { rows: StatementRow[]; problems: string[] } {
  const grid = parseCsv(text);
  const h = grid.findIndex((r) => r.some((c) => /narration|description|particulars/i.test(c)) && r.some((c) => /deposit|credit/i.test(c)));
  if (h < 0) return { rows: [], problems: ["Couldn't find the header row. It needs a Narration (or Description) column and a Deposit (or Credit) column."] };
  const header = grid[h].map((c) => c.toLowerCase());
  const col = (re: RegExp, not?: RegExp) => header.findIndex((c) => re.test(c) && !not?.test(c));
  const at = {
    date: col(/date|\bdt\b/, /value/),
    narration: col(/narration|description|particulars/),
    ref: col(/ref|chq|cheque|utr/),
    debit: col(/withdrawal|debit/),
    credit: col(/deposit|credit/),
    balance: col(/balance/),
  };
  if (at.date < 0) return { rows: [], problems: ["The statement has no Date column."] };

  const rows: StatementRow[] = [];
  const problems: string[] = [];
  for (let i = h + 1; i < grid.length; i++) {
    const r = grid[i];
    if (r.every((c) => !c)) continue;
    const date = parseDate(r[at.date] ?? "");
    if (!date) continue; // footer lines ("Closing balance", "** End of statement **")
    const credit = parseAmount(r[at.credit] ?? "");
    const debit = at.debit >= 0 ? parseAmount(r[at.debit] ?? "") : 0;
    const balance = at.balance >= 0 && r[at.balance] ? parseAmount(r[at.balance]) : null;
    if (Number.isNaN(credit) || Number.isNaN(debit)) {
      problems.push(`Line ${i + 1}: unreadable amount, skipped.`);
      continue;
    }
    rows.push({ line: i + 1, date, narration: r[at.narration] ?? "", ref: at.ref >= 0 ? (r[at.ref] ?? "") : "", debit, credit, balance: Number.isNaN(balance) ? null : balance });
  }
  return { rows, problems };
}
