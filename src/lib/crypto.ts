import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

function secret() {
  const s = process.env.APP_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET is not set");
  return "dev-only-secret"; // placeholder for local runs; production sets APP_SECRET
}

/** Keyed hash for short secrets (OTPs, guest codes): useless without APP_SECRET even if the table leaks. */
export const keyedHash = (value: string) => createHmac("sha256", secret()).update(value).digest("hex");
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const randomDigits = (n: number) => String(randomInt(0, 10 ** n)).padStart(n, "0");
export const sameHex = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const sign = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("hex");
