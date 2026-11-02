/** "+91 98000 00001", "098000-00001" -> "9800000001"; null unless it is a valid Indian mobile. */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** "9800000001" -> "98•••••001" */
export const maskPhone = (p: string) => `${p.slice(0, 2)}•••••${p.slice(-3)}`;
