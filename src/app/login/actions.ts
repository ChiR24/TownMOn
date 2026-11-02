"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { homeFor, startSession } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { checkOtp, issueOtp } from "@/lib/otp";
import { normalizePhone } from "@/lib/phone";

export type LoginState = {
  step: "phone" | "code";
  phone?: string;
  error?: "phone" | "wrong" | "expired" | "locked" | "tooMany" | "noaccess";
  demoCode?: string;
};

/** One action, three intents: send a code, verify it, or go back to change the number. */
export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const intent = form.get("intent");
  if (intent === "change") return { step: "phone" };
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  if (!phone) return { step: "phone", error: "phone" };

  const [user] = await db
    .select({ id: users.id, role: users.role, privacyAcceptedAt: users.privacyAcceptedAt })
    .from(users)
    .where(and(eq(users.phone, phone), eq(users.active, true)));

  if (intent === "send") {
    // Same response for unknown numbers, so the form can't be used to find out who lives here.
    const r = await issueOtp(db, phone);
    if (!r.ok) return { step: "code", phone, error: r.error };
    if (user) await db.insert(notifications).values({ userId: user.id, channel: "SMS", title: "Sign-in code sent", body: "A 6-digit sign-in code was sent by SMS." });
    return { step: "code", phone, demoCode: DEMO_MODE && user ? r.code : undefined };
  }

  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  const result = code.length === 6 ? await checkOtp(db, phone, code) : "wrong";
  if (result !== "ok") return { step: "code", phone, error: result };
  if (!user) return { step: "code", phone, error: "wrong" };
  if (user.role === "TECHNICIAN") return { step: "phone", error: "noaccess" };
  await startSession(user.id);
  redirect(user.privacyAcceptedAt ? homeFor(user.role) : "/welcome");
}
