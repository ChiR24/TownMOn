import { describe, expect, it } from "vitest";
import { findFlatCodes, matchCredit, oneSlip, parseAmount, parseCsv, parseDate, readNarration, readStatement, type MatchContext } from "./bank";

describe("reading a statement", () => {
  it("parses quoted CSV cells", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });

  it("reads Indian date formats, day first", () => {
    expect(parseDate("02/11/26")).toBe("2026-11-02");
    expect(parseDate("2-11-2026")).toBe("2026-11-02");
    expect(parseDate("02-Nov-2026")).toBe("2026-11-02");
    expect(parseDate("2026-11-02")).toBe("2026-11-02");
    expect(parseDate("31/02/26")).toBeNull();
    expect(parseDate("Closing balance")).toBeNull();
  });

  it("reads amounts into paise", () => {
    expect(parseAmount("7,475.00")).toBe(747_500);
    expect(parseAmount("₹ 6370")).toBe(637_000);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("abc")).toBeNaN();
  });

  it("finds the header under a preamble and skips the footer", () => {
    const csv = [
      "HDFC BANK LTD,,,,,,",
      "Account: Township Residents Federation,,,,,,",
      "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance",
      '02/11/26,"UPI-NEERAJ KULKARNI-neeraj.k@okhdfcbank-HDFC0001234-612345678901-T07 1203 maint",612345678901,02/11/26,,"7,475.00","12,07,475.00"',
      "02/11/26,PAYMENT TO LIFT VENDOR,000045,02/11/26,25000.00,,1182475.00",
      "** End of statement **,,,,,,",
    ].join("\n");
    const { rows, problems } = readStatement(csv);
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: "2026-11-02", credit: 747_500, debit: 0, balance: 120_747_500, ref: "612345678901" });
    expect(rows[1]).toMatchObject({ credit: 0, debit: 2_500_000 });
  });

  it("explains a file it can't use", () => {
    expect(readStatement("foo,bar\n1,2").problems[0]).toMatch(/header row/);
  });
});

describe("reading a narration", () => {
  it("reads an HDFC-style UPI credit", () => {
    const n = readNarration("UPI-NEERAJ KULKARNI-neeraj.k@okhdfcbank-HDFC0001234-612345678901-T07 1203 maint");
    expect(n).toMatchObject({ method: "UPI", vpa: "neeraj.k@okhdfcbank", utr: "612345678901", payerName: "Neeraj Kulkarni", flatHints: ["T07-1203"] });
  });

  it("reads an ICICI-style UPI credit", () => {
    const n = readNarration("UPI/CR/612345678902/SWATI J/ICIC/swati.j@okicici/T12 0408");
    expect(n).toMatchObject({ method: "UPI", vpa: "swati.j@okicici", payerName: "Swati J", flatHints: ["T12-0408"] });
  });

  it("reads NEFT, IMPS and cheques", () => {
    expect(readNarration("NEFT CR-ICIC0000123-SWATI JOSHI-TOWNSHIP FEDERATION-ICICN52026101512345678")).toMatchObject({
      method: "NEFT",
      payerName: "Swati Joshi",
      utr: "ICICN52026101512345678",
    });
    expect(readNarration("IMPS-612345678903-AAMIR SHAIKH-HDFC-XXXXXXXX1234-MAINT T21 1601")).toMatchObject({ method: "IMPS", payerName: "Aamir Shaikh", flatHints: ["T21-1601"] });
    expect(readNarration("CHQ DEP 000123 KULKARNI N")).toMatchObject({ method: "CHEQUE", payerName: "Kulkarni N" });
  });

  it("spots gateway payouts and bank interest", () => {
    expect(readNarration("TESTPAY PAYMENTS SETTLEMENT setl_Nx81Ab").settlementId).toBe("setl_Nx81Ab");
    expect(readNarration("INT.PD 01-07-26 TO 30-09-26").bankInterest).toBe(true);
  });

  it("normalises the ways residents write a flat number", () => {
    for (const s of ["T7 1203", "T07-1203", "tower 7 flat 1203", "T071203", "Flat 1203 T7", "T-07/1203"]) expect(findFlatCodes(s)).toEqual(["T07-1203"]);
    expect(findFlatCodes("T12 408")).toEqual(["T12-0408"]);
    expect(findFlatCodes("UTR 612345678901 paid 02-11-2026")).toEqual([]);
  });
});

describe("matching a credit to a flat", () => {
  const flats = ["T07-1203", "T07-1204", "T12-0408", "T21-1601", "T21-1602"];
  const dues: Record<string, { outstanding: number; current: number }> = {
    "T07-1203": { outstanding: 747_500, current: 747_500 },
    "T07-1204": { outstanding: 747_500, current: 747_500 },
    "T12-0408": { outstanding: 1_284_100, current: 637_000 },
    "T21-1601": { outstanding: 1_632_600, current: 1_066_000 },
    "T21-1602": { outstanding: 1_066_000, current: 1_066_000 },
  };
  const ctx: MatchContext = {
    flatExists: (f) => flats.includes(f),
    nearestFlat: (f) => {
      const near = flats.filter((x) => x.slice(0, 4) === f.slice(0, 4) && oneSlip(x.slice(4), f.slice(4)));
      return near.length === 1 ? near[0] : undefined;
    },
    flatsForVpa: (v) => ({ "neeraj.k@okhdfcbank": ["T07-1203"], "landlord@ybl": ["T07-1203", "T07-1204"] })[v] ?? [],
    due: (f) => dues[f],
    names: (f) => ({ "T07-1203": ["Neeraj Kulkarni", "Meera Kulkarni"], "T12-0408": ["Swati Joshi"], "T21-1601": ["Aamir Shaikh"] })[f] ?? [],
    flatsOwing: (a) => flats.filter((f) => dues[f].outstanding === a || dues[f].current === a),
    settlement: (id) => (id === "setl_A1" ? { amount: 2_000_000, count: 3 } : undefined),
  };
  const match = (amount: number, narration: string) => matchCredit(amount, readNarration(narration), ctx);

  it("posts when the flat number and the amount agree", () => {
    const r = match(747_500, "UPI-SOMEONE ELSE-x.y@ybl-YESB0000001-612345678904-T07 1203");
    expect(r.status).toBe("AUTO_MATCHED");
    expect(r.flatId).toBe("T07-1203");
  });

  it("posts a known UPI ID whose amount equals the dues, even without a flat number", () => {
    const r = match(747_500, "UPI-NEERAJ KULKARNI-neeraj.k@okhdfcbank-HDFC0001234-612345678905-maintenance");
    expect(r).toMatchObject({ status: "AUTO_MATCHED", flatId: "T07-1203" });
  });

  it("posts a part payment when the note and the payer's name agree", () => {
    const r = match(500_000, "IMPS-612345678903-AAMIR SHAIKH-HDFC-XXXXXXXX1234-MAINT T21 1601");
    expect(r).toMatchObject({ status: "AUTO_MATCHED", flatId: "T21-1601" });
  });

  it("holds a part payment with only the flat number", () => {
    const r = match(300_000, "UPI-R K-rk@ybl-YESB0000001-612345678906-T21 1601");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.suggestions[0].flatId).toBe("T21-1601");
  });

  it("never posts on the amount alone, but suggests the flats that owe it", () => {
    const r = match(747_500, "NEFT CR-SBIN0001234-R MEHTA-TOWNSHIP FEDERATION-SBIN52026110212345");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.reasons[0]).toMatch(/Only the amount/);
    expect(r.suggestions.map((s) => s.flatId).sort()).toEqual(["T07-1203", "T07-1204"]);
  });

  it("holds conflicting signals for a person", () => {
    const r = match(747_500, "UPI-NEERAJ KULKARNI-neeraj.k@okhdfcbank-HDFC0001234-612345678907-T07 1204");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.reasons[0]).toMatch(/different flats/);
  });

  it("holds a UPI ID that pays for two flats", () => {
    expect(match(747_500, "UPI-LANDLORD-landlord@ybl-YESB0000001-612345678908-maint").status).toBe("NEEDS_REVIEW");
  });

  it("suggests the right flat for a typo but does not post it", () => {
    const r = match(637_000, "NEFT CR-ICIC0000123-SWATI JOSHI-TOWNSHIP FEDERATION-T12 0480");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.suggestions[0].flatId).toBe("T12-0408");
  });

  it("reconciles gateway payouts without posting them twice", () => {
    expect(match(2_000_000, "TESTPAY SETTLEMENT setl_A1").status).toBe("SETTLEMENT");
    expect(match(1_900_000, "TESTPAY SETTLEMENT setl_A1").status).toBe("NEEDS_REVIEW");
  });

  it("ignores bank interest", () => {
    expect(match(12_345, "INT.PD 01-07-26 TO 30-09-26").status).toBe("IGNORED");
  });
});

describe("one-slip typos", () => {
  it("accepts one wrong or two swapped digits", () => {
    expect(oneSlip("0408", "0480")).toBe(true);
    expect(oneSlip("0408", "0409")).toBe(true);
    expect(oneSlip("0408", "0804")).toBe(false);
    expect(oneSlip("0408", "0408")).toBe(false);
  });
});
