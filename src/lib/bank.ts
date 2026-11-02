import { rupees } from "./money";

// Reading bank statement CSVs and deciding which flat each credit belongs to.
// Everything here is pure: the import service feeds it the facts (flats, dues, known UPI IDs).

export type Method = "UPI" | "NEFT" | "IMPS" | "CHEQUE" | "CASH" | "OTHER";
export type StatementRow = { line: number; date: string; narration: string; ref: string; debit: number; credit: number; balance: number | null };

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
      else if (s[i + 1] === '"') (cell += '"'), i++;
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") row.push(cell), (cell = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
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

// ---------- reading a narration ----------

export type Narration = {
  method: Method;
  vpa?: string;
  payerName?: string;
  utr?: string;
  flatHints: string[];
  settlementId?: string;
  bankInterest: boolean;
};

/** "T7 1203", "T07-1203", "Tower 7 Flat 1203", "T071203", "flat 1203 T7" -> "T07-1203". */
export function findFlatCodes(text: string): string[] {
  const s = text.toUpperCase();
  const out = new Set<string>();
  const add = (tower: string, flat: string) => {
    if (Number(tower) >= 1 && flat.length <= 4) out.add(`T${tower.padStart(2, "0")}-${flat.padStart(4, "0")}`);
  };
  for (const m of s.matchAll(/\bT(?:OWER|WR)?\s*[-/.:#]?\s*(\d{1,2})\s*[-/,.\s]\s*(?:FLAT|FL|F)?\s*[-/.:#]?\s*(\d{3,4})\b/g)) add(m[1], m[2]);
  for (const m of s.matchAll(/\bT(\d{2})(\d{4})\b/g)) add(m[1], m[2]);
  for (const m of s.matchAll(/\b(?:FLAT|FL|F)\s*[-/.:#]?\s*(\d{3,4})\s*[-/,.\s]\s*T(?:OWER|WR)?\s*[-/.:#]?\s*(\d{1,2})\b/g)) add(m[2], m[1]);
  return [...out];
}

const NOISE = new Set(
  "UPI CR DR NEFT IMPS RTGS P2A P2M CHQ CHEQUE DEP DEPOSIT CLG CLEARING MAINT MAINTENANCE PAYMENT PAY BILL BILLS TOWNSHIP SOCIETY FEDERATION RESIDENTS TRANSFER TRF TO FROM FOR BY AND THE OF INWARD REMITTANCE HDFC ICICI SBI AXIS KOTAK YESB IDFC PNB BOB CANARA UNION INDUSIND BANK LTD TOWER FLAT".split(" "),
);

/** First segment that reads like a person's name; falls back to whatever survives noise removal (cheques). */
function guessName(narration: string): string | undefined {
  const isName = (t: string) => /^[A-Za-z][A-Za-z .']{2,40}$/.test(t) && t.split(/\s+/).some((w) => w.length >= 2 && !NOISE.has(w.toUpperCase()));
  const segment = narration.split(/[-/|]/).map((t) => t.trim()).find(isName);
  const raw = segment ?? narration.split(/\s+/).filter((w) => /^[A-Za-z.']+$/.test(w) && !NOISE.has(w.toUpperCase())).join(" ");
  const words = raw.split(/\s+/).filter((w) => w && !NOISE.has(w.toUpperCase()));
  if (words.join("").length < 3) return undefined;
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

export function readNarration(narration: string, ref = ""): Narration {
  const n = narration.toUpperCase();
  const method: Method = /^UPI|\bUPI[/-]/.test(n)
    ? "UPI"
    : /\bNEFT\b|\bRTGS\b/.test(n)
      ? "NEFT"
      : /\bIMPS\b/.test(n)
        ? "IMPS"
        : /\b(CHQ|CHEQUE|CLG|CLEARING)\b/.test(n)
          ? "CHEQUE"
          : /\bCASH\b/.test(n)
            ? "CASH"
            : "OTHER";
  const vpa = narration.match(/[a-z0-9._]{2,}@[a-z][a-z0-9]+/i)?.[0].toLowerCase();
  const utr = n.match(/\b\d{12}\b/)?.[0] ?? n.match(/\b[A-Z]{4}[A-Z0-9]{12,18}\b/)?.[0] ?? (ref || undefined);
  const withoutVpa = vpa ? narration.replace(new RegExp(vpa.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ") : narration;
  return {
    method,
    vpa,
    utr,
    payerName: guessName(withoutVpa.replace(/\bT\d{1,2}\b|\b\d+\b/gi, " ")),
    flatHints: findFlatCodes(n),
    settlementId: narration.match(/\bsetl_[A-Za-z0-9]+\b/)?.[0],
    bankInterest: /\b(INT\.? ?PD|INTEREST (CREDIT|PAID)|CREDIT INTEREST|SB INT)\b/.test(n),
  };
}

// ---------- matching a credit to a flat ----------

export type MatchContext = {
  flatExists(flatId: string): boolean;
  /** Typo recovery: the one existing flat one digit-slip away (T12-0480 -> T12-0408), if exactly one. */
  nearestFlat(flatId: string): string | undefined;
  flatsForVpa(vpa: string): string[];
  due(flatId: string): { outstanding: number; current: number } | undefined;
  names(flatId: string): string[];
  flatsOwing(amount: number): string[];
  settlement(id: string): { amount: number; count: number } | undefined;
};

export type MatchResult = {
  status: "AUTO_MATCHED" | "NEEDS_REVIEW" | "SETTLEMENT" | "IGNORED";
  flatId?: string;
  confidence: number;
  reasons: string[];
  suggestions: { flatId: string; score: number; reasons: string[] }[];
};

/** "full": the payer is one of the residents (every part of their name appears). "partial": one shared name. */
export function nameMatch(payer: string, residents: string[]): "full" | "partial" | null {
  const p = payer.toUpperCase().split(/\s+/).filter((w) => w.length >= 3);
  let partial = false;
  for (const r of residents) {
    const words = r.toUpperCase().replace(/\(.*?\)|\./g, " ").split(/\s+/).filter((w) => w.length >= 3);
    const hits = words.filter((w) => p.includes(w)).length;
    if (hits >= 2 && hits === words.length) return "full";
    partial ||= hits > 0;
  }
  return partial ? "partial" : null;
}

/**
 * The rule: post automatically only when exactly one flat has a strong identifier (its flat number in the
 * note, or a UPI ID that paid for it before) AND a second, independent signal agrees (the other identifier,
 * the amount equals its dues, or the payer's name matches a resident). Everything else waits for a person.
 */
export function matchCredit(amount: number, n: Narration, ctx: MatchContext): MatchResult {
  if (n.settlementId) {
    const s = ctx.settlement(n.settlementId);
    if (s && s.amount === amount)
      return { status: "SETTLEMENT", confidence: 100, reasons: [`Gateway payout ${n.settlementId} for ${s.count} online payments, already posted when residents paid`], suggestions: [] };
    return {
      status: "NEEDS_REVIEW",
      confidence: 0,
      reasons: [s ? `Gateway payout ${n.settlementId} should be ${rupees(s.amount)} but the bank shows ${rupees(amount)}` : `Unknown gateway payout ${n.settlementId}`],
      suggestions: [],
    };
  }
  if (n.bankInterest) return { status: "IGNORED", confidence: 100, reasons: ["Interest paid by the bank, not a resident payment"], suggestions: [] };

  const cands = new Map<string, { score: number; reasons: string[]; strong: boolean }>();
  const add = (flatId: string, score: number, reason: string, strong = false) => {
    const c = cands.get(flatId) ?? { score: 0, reasons: [], strong: false };
    c.score += score;
    if (reason) c.reasons.push(reason);
    c.strong ||= strong;
    cands.set(flatId, c);
  };

  for (const code of n.flatHints) {
    if (ctx.flatExists(code)) add(code, 50, `Payment note says ${code}`, true);
    else {
      const near = ctx.nearestFlat(code);
      if (near) add(near, 20, `Note says ${code}, which doesn't exist; closest flat is ${near}`);
    }
  }
  if (n.vpa) for (const f of ctx.flatsForVpa(n.vpa)) add(f, 45, `UPI ID ${n.vpa} has paid for ${f} before`, true);
  const amountOnly = cands.size === 0;
  if (amountOnly) for (const f of ctx.flatsOwing(amount).slice(0, 200)) add(f, 0, "");

  for (const [flatId] of cands) {
    const d = ctx.due(flatId);
    if (d && d.outstanding > 0 && amount === d.outstanding) add(flatId, 25, `Amount equals the full dues of ${rupees(d.outstanding)}`);
    else if (d && d.current > 0 && amount === d.current) add(flatId, 20, `Amount equals this month's bill of ${rupees(d.current)}`);
    const name = n.payerName ? nameMatch(n.payerName, ctx.names(flatId)) : null;
    if (name === "full") add(flatId, 20, `Payer ${n.payerName} is a resident of ${flatId}`);
    else if (name === "partial") add(flatId, 8, `Payer ${n.payerName} shares a name with a resident`);
  }

  const ranked = [...cands]
    .map(([flatId, c]) => ({ flatId, score: Math.min(100, c.score), reasons: c.reasons, strong: c.strong }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  const strong = ranked.filter((c) => c.strong);
  const top = ranked[0];
  const suggestions = ranked.slice(0, 5).map(({ flatId, score, reasons }) => ({ flatId, score, reasons }));

  if (top && strong.length === 1 && strong[0] === top && top.reasons.length >= 2)
    return { status: "AUTO_MATCHED", flatId: top.flatId, confidence: top.score, reasons: top.reasons, suggestions: [] };

  let why: string;
  if (!top) why = "No flat number, known UPI ID or matching amount";
  else if (strong.length > 1) why = `Signals point to different flats: ${strong.map((c) => c.flatId).join(", ")}`;
  else if (amountOnly) why = `Only the amount matches, and ${ctx.flatsOwing(amount).length} flats owe it`;
  else if (strong.length === 0) why = "No exact flat number or known UPI ID; check the closest match";
  else why = "Only one signal; a second must agree before it is posted automatically";
  return { status: "NEEDS_REVIEW", confidence: top?.score ?? 0, reasons: [why], suggestions };
}

/** Damerau distance 1 between two equal-length digit strings (one wrong digit, or two swapped). */
export function oneSlip(a: string, b: string) {
  if (a.length !== b.length || a === b) return false;
  const diff = [...a].map((ch, i) => (ch === b[i] ? -1 : i)).filter((i) => i >= 0);
  if (diff.length === 1) return true;
  return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
}
