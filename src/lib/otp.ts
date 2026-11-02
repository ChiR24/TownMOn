import { and, count, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { Q } from "@/db";
import { otpChallenges } from "@/db/schema";
import { keyedHash, randomDigits, sameHex } from "./crypto";

export const OTP_TTL_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_10_MIN = 3;

const hashFor = (phone: string, code: string) => keyedHash(`otp:${phone}:${code}`);

/** Creates a one-time code. Same behaviour whether or not the number is registered, so it can't be used to probe. */
export async function issueOtp(q: Q, phone: string, now = new Date()) {
  const [{ n }] = await q
    .select({ n: count() })
    .from(otpChallenges)
    .where(and(eq(otpChallenges.phone, phone), gt(otpChallenges.createdAt, new Date(now.getTime() - 10 * 60_000))));
  if (n >= OTP_MAX_PER_10_MIN) return { ok: false as const, error: "tooMany" as const };
  const code = randomDigits(6);
  await q.insert(otpChallenges).values({ phone, codeHash: hashFor(phone, code), expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000), createdAt: now });
  return { ok: true as const, code };
}

export type OtpCheck = "ok" | "wrong" | "expired" | "locked";

/** Checks the latest unused code. Every try counts; five wrong tries lock it; a code works once. */
export async function checkOtp(q: Q, phone: string, code: string, now = new Date()): Promise<OtpCheck> {
  const [c] = await q
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.phone, phone), isNull(otpChallenges.consumedAt)))
    .orderBy(desc(otpChallenges.id))
    .limit(1);
  if (!c || c.expiresAt <= now) return "expired";
  if (c.attempts >= OTP_MAX_ATTEMPTS) return "locked";
  const [{ attempts }] = await q
    .update(otpChallenges)
    .set({ attempts: sql`${otpChallenges.attempts} + 1` })
    .where(eq(otpChallenges.id, c.id))
    .returning({ attempts: otpChallenges.attempts });
  if (!sameHex(c.codeHash, hashFor(phone, code))) return attempts >= OTP_MAX_ATTEMPTS ? "locked" : "wrong";
  await q.update(otpChallenges).set({ consumedAt: now }).where(eq(otpChallenges.id, c.id));
  return "ok";
}
