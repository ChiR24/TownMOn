// How Indian banks write incoming credits. Used to seed history and to build the demo statement,
// so the matcher is always exercised against the same shapes real statements have.

export const BANKS = [
  { code: "HDFC", ifsc: "HDFC0001234", handle: "okhdfcbank" },
  { code: "ICIC", ifsc: "ICIC0000123", handle: "okicici" },
  { code: "SBIN", ifsc: "SBIN0001234", handle: "oksbi" },
  { code: "UTIB", ifsc: "UTIB0002345", handle: "okaxis" },
  { code: "KKBK", ifsc: "KKBK0001765", handle: "kotak" },
  { code: "YESB", ifsc: "YESB0000001", handle: "ybl" },
] as const;
export type Bank = (typeof BANKS)[number];

export type Remitter = {
  method: "UPI" | "NEFT" | "IMPS" | "CHEQUE";
  name: string;
  vpa?: string;
  bank: Bank;
  flatId: string;
  /** Did the resident write the flat number in the payment note? */
  withFlat: boolean;
  ref: string;
};

export function narrationFor(r: Remitter) {
  const name = r.name.toUpperCase();
  const note = r.withFlat ? `${r.flatId.replace("-", " ")} maint` : "maintenance";
  switch (r.method) {
    case "UPI":
      return `UPI-${name}-${r.vpa}-${r.bank.ifsc}-${r.ref}-${note}`;
    case "NEFT":
      return `NEFT CR-${r.bank.ifsc}-${name}-TOWNSHIP RESIDENTS FEDERATION-${r.ref}${r.withFlat ? ` ${r.flatId.replace("-", " ")}` : ""}`;
    case "IMPS":
      return `IMPS-${r.ref}-${name}-${r.bank.code}-XXXXXXXX${r.ref.slice(-4)}-${note}`;
    case "CHEQUE": {
      const [first, ...rest] = name.split(" ");
      return `CHQ DEP ${r.ref} ${rest.join(" ") || first} ${first[0]}`;
    }
  }
}

/** UPI/IMPS RRN (12 digits), NEFT UTR (bank code + N + date + serial) or a cheque number. */
export function refFor(method: Remitter["method"], bank: Bank, date: string, serial: number) {
  const n = String(serial).padStart(8, "0");
  if (method === "NEFT") return `${bank.code}N5${date.replaceAll("-", "")}${n}`;
  if (method === "CHEQUE") return String(100000 + (serial % 900000));
  return `6${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}${n.slice(-5)}`;
}

export const vpaFor = (name: string, bank: Bank, n: number) => `${name.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, ".")}${n % 7 === 0 ? n % 100 : ""}@${bank.handle}`;
