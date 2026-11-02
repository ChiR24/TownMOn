"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { gatewayOrders } from "@/db/schema";
import { requireResident } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { flatPosition } from "@/lib/data";

const Input = z.object({ choice: z.enum(["full", "other"]), amount: z.string().optional() });
const MAX_PAISE = 5_00_000_00; // ₹5,00,000

export type PayState = { error?: "amount"; typed?: string };

/** Creates the order on the server, so the amount the gateway charges is the one we decided, not the browser. */
export async function startPayment(_: PayState, form: FormData): Promise<PayState> {
  const { user, flat } = await requireResident();
  const typed = String(form.get("amount") ?? "");
  const parsed = Input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "amount", typed };
  const amount = parsed.data.choice === "full" ? (await flatPosition(flat.flatId)).balance : Math.round(Number(parsed.data.amount) * 100);
  if (!Number.isInteger(amount) || amount < 100 || amount > MAX_PAISE) return { error: "amount", typed };
  const id = `order_${randomToken(9)}`;
  await db.insert(gatewayOrders).values({ id, flatId: flat.flatId, amount, createdBy: user.id });
  redirect(`/pay/${id}`);
}
