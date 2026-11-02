import { rupees } from "./money";

// Deciding which flat each bank credit belongs to. Everything here is pure: the import service feeds it the facts
// (flats, dues, known UPI IDs). Reading the CSV file itself is in bank-csv.ts.

export type Method = "UPI" | "NEFT" | "IMPS" | "CHEQUE" | "CASH" | "OTHER";

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

type MatchResult = {
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

  // `signals` counts only independent evidence. A typo'd flat number (the same note again) and a shared surname
  // raise the score and show as reasons, but never count towards the two signals an automatic posting needs.
  const cands = new Map<string, { score: number; reasons: string[]; strong: boolean; signals: number }>();
  const add = (flatId: string, score: number, reason: string, strong = false, signal = reason !== "") => {
    const c = cands.get(flatId) ?? { score: 0, reasons: [], strong: false, signals: 0 };
    c.score += score;
    if (reason) c.reasons.push(reason);
    c.strong ||= strong;
    if (signal) c.signals++;
    cands.set(flatId, c);
  };

  for (const code of n.flatHints) {
    if (ctx.flatExists(code)) add(code, 50, `Payment note says ${code}`, true);
    else {
      const near = ctx.nearestFlat(code);
      if (near) add(near, 20, `Note says ${code}, which doesn't exist; closest flat is ${near}`, false, false);
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
    else if (name === "partial") add(flatId, 8, `Payer ${n.payerName} shares a name with a resident`, false, false);
  }

  const ranked = [...cands]
    .map(([flatId, c]) => ({ flatId, score: Math.min(100, c.score), reasons: c.reasons, strong: c.strong, signals: c.signals }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  const strong = ranked.filter((c) => c.strong);
  const top = ranked[0];
  const suggestions = ranked.slice(0, 5).map(({ flatId, score, reasons }) => ({ flatId, score, reasons }));

  if (top && strong.length === 1 && strong[0] === top && top.signals >= 2)
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
