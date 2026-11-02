import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { gatewayOrders } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { signCallback } from "@/lib/payments";

// The mock gateway's "Pay" button posts here. Like a real hosted checkout, it answers with a full-page
// redirect to our callback, carrying a signed result. Only the resident who created the order can complete it.
export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (req.headers.get("origin") !== new URL(req.url).origin) return new Response("Forbidden", { status: 403 });
  const user = await currentUser();
  const { orderId } = await params;
  const [o] = await db.select().from(gatewayOrders).where(eq(gatewayOrders.id, orderId));
  if (!user || !o || o.createdBy !== user.id || o.status !== "CREATED") return Response.redirect(new URL("/bills", req.url), 303);

  const form = await req.formData();
  const method = z.enum(["UPI", "CARD", "NETBANKING"]).catch("UPI").parse(form.get("method"));
  const status = form.get("outcome") === "fail" ? "failed" : "captured";
  const paymentId = `pay_${randomToken(10)}`;
  const signature = signCallback(orderId, paymentId, status, method);
  const back = new URL(`/api/payments/callback?${new URLSearchParams({ order_id: orderId, payment_id: paymentId, status, method, signature })}`, req.url);
  return Response.redirect(back, 303);
}
