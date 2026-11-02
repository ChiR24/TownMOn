// All money is integer paise. Rupees only appear at the edges (display and parsing).
const whole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

/** 747500 -> "₹7,475"; 747550 -> "₹7,475.50" */
export const rupees = (paise: number) => (paise % 100 === 0 ? whole : exact).format(paise / 100);
export const toPaise = (rupeeAmount: number) => Math.round(rupeeAmount * 100);
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n: number) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
const three = (n: number) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : "", n % 100 ? two(n % 100) : ""].filter(Boolean).join(" ");

/** Receipts state the amount in words, Indian style: 747500 -> "Rupees Seven Thousand Four Hundred Seventy-Five only". */
export function inWords(paise: number) {
  const r = Math.floor(paise / 100);
  const p = paise % 100;
  const parts = [
    Math.floor(r / 1e7) && `${three(Math.floor(r / 1e7))} Crore`,
    Math.floor(r / 1e5) % 100 && `${two(Math.floor(r / 1e5) % 100)} Lakh`,
    Math.floor(r / 1e3) % 100 && `${two(Math.floor(r / 1e3) % 100)} Thousand`,
    r % 1000 && three(r % 1000),
  ].filter(Boolean);
  return `Rupees ${parts.join(" ") || "Zero"}${p ? ` and ${two(p)} Paise` : ""} only`;
}
