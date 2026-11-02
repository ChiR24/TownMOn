import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { gatewayOrders } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { sameHex } from "@/lib/crypto";
import { captureOrder, signCallback } from "@/lib/payments";

const Params = z.object({
  order_id: z.string().regex(/^order_[\w-]+$/),
  payment_id: z.string().regex(/^pay_[\w-]+$/),
  status: z.enum(["captured", "failed"]),
  method: z.enum(["UPI", "CARD", "NETBANKING"]),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
});

/** The gateway sends the browser here. Nothing is trusted until the signature checks out. */
export async function GET(req: NextRequest) {
  const parsed = Params.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const p = parsed.data;
  if (!sameHex(p.signature, signCallback(p.order_id, p.payment_id, p.status, p.method))) return new Response("Invalid signature", { status: 400 });

  if (p.status === "failed") {
    await db.update(gatewayOrders).set({ status: "FAILED" }).where(and(eq(gatewayOrders.id, p.order_id), eq(gatewayOrders.status, "CREATED")));
    redirect("/bills/pay?failed=1");
  }
  const payer = await currentUser();
  const paymentId = await captureOrder(db, p.order_id, p.payment_id, p.method, payer?.name ?? null);
  if (!paymentId) return new Response("Unknown order", { status: 404 });
  redirect(`/receipts/${paymentId}?new=1`);
}
