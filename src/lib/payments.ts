import { eq } from "drizzle-orm";
import type { Q, Tx } from "@/db";
import { gatewayOrders, ledger, notifications, payments } from "@/db/schema";
import { sign } from "./crypto";
import { addDays, todayIST } from "./dates";
import { flatPeople } from "./data";
import { rupees } from "./money";

type Method = (typeof payments.method.enumValues)[number];

/** Financial-year receipt number: R/2026-27/000123 (FY runs April to March). */
export function receiptNo(id: number, paidOn: string) {
  const y = Number(paidOn.slice(0, 4));
  const start = Number(paidOn.slice(5, 7)) >= 4 ? y : y - 1;
  return `R/${start}-${String((start + 1) % 100).padStart(2, "0")}/${String(id).padStart(6, "0")}`;
}

export const METHOD_LABEL: Record<Method, string> = { UPI: "UPI", NEFT: "NEFT / RTGS", IMPS: "IMPS", CHEQUE: "Cheque", CARD: "Card", NETBANKING: "Net banking", CASH: "Cash", OTHER: "Other" };

/**
 * The only way money enters a flat's account: one payments row, one ledger credit, a receipt notice to the
 * household. Callers pass a transaction so the three always land together.
 */
export async function postPayment(
  tx: Tx,
  p: { flatId: string; amount: number; method: Method; source: "GATEWAY" | "BANK" | "MANUAL"; paidOn: string; reference?: string | null; payerVpa?: string | null; payerName?: string | null; gatewayPaymentId?: string; bankTxnId?: number; createdBy?: number | null },
) {
  const [pay] = await tx.insert(payments).values(p).returning({ id: payments.id });
  await tx.insert(ledger).values({
    flatId: p.flatId,
    kind: "PAYMENT",
    amount: -p.amount,
    date: p.paidOn,
    paymentId: pay.id,
    memo: p.source === "GATEWAY" ? "Paid in the app" : `${METHOD_LABEL[p.method]} received`,
    createdBy: p.createdBy ?? null,
  });
  const people = await flatPeople(p.flatId, tx);
  if (people.length)
    await tx.insert(notifications).values(
      people.map((u) => ({ userId: u.id, title: `${rupees(p.amount)} received for ${p.flatId}`, body: `Receipt ${receiptNo(pay.id, p.paidOn)}. Thank you.`, link: `/receipts/${pay.id}` })),
    );
  return pay.id;
}

// ---------- the mock payment gateway (test mode) ----------
// Same shape as a real gateway: the server creates the order (so the amount can't be changed in the browser),
// the gateway signs its callback with a shared secret, and capture is idempotent on the gateway's payment id.

export function gatewaySecret() {
  const s = process.env.GATEWAY_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("GATEWAY_SECRET is not set");
  return "dev-only-gateway-secret";
}

export const signCallback = (orderId: string, paymentId: string, status: string, method: string) => sign(`${orderId}|${paymentId}|${status}|${method}`, gatewaySecret());

/** Posts a captured order exactly once, however many times the gateway calls back. Returns the payment id. */
export async function captureOrder(q: Q, orderId: string, gatewayPaymentId: string, method: Method, payerName: string | null, today = todayIST()) {
  return q.transaction(async (tx) => {
    const [o] = await tx.select().from(gatewayOrders).where(eq(gatewayOrders.id, orderId)).for("update");
    if (!o) return null;
    if (o.status === "PAID") return o.paymentId;
    const id = await postPayment(tx, { flatId: o.flatId, amount: o.amount, method, source: "GATEWAY", paidOn: today, reference: gatewayPaymentId, gatewayPaymentId, payerName, createdBy: o.createdBy });
    // The gateway pays out the day's collections to the society's bank the next day under one settlement id.
    await tx
      .update(gatewayOrders)
      .set({ status: "PAID", paymentId: id, paidAt: new Date(), settlementId: `setl_${addDays(today, 1).replaceAll("-", "")}` })
      .where(eq(gatewayOrders.id, orderId));
    return id;
  });
}
