// All money is integer paise. Rupees only appear at the edges (display and parsing).
const whole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

/** 747500 -> "₹7,475"; 747550 -> "₹7,475.50" */
export const rupees = (paise: number) => (paise % 100 === 0 ? whole : exact).format(paise / 100);
export const toPaise = (rupeeAmount: number) => Math.round(rupeeAmount * 100);
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
