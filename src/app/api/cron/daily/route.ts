import { db } from "@/db";
import { generateBills } from "@/lib/billing-run";
import { sameHex, sha256 } from "@/lib/crypto";
import { todayIST } from "@/lib/dates";
import { purgeVisitorPhotos } from "@/lib/gate";

// Runs once a day (vercel.json): raises the month's bills on the 1st (idempotent on every other day)
// and deletes visitor photos older than 90 days. Vercel Cron sends "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !sameHex(sha256(given), sha256(secret))) return new Response("Unauthorized", { status: 401 });
  const bills = await generateBills(db, todayIST().slice(0, 7), null);
  const photosDeleted = await purgeVisitorPhotos(db);
  return Response.json({ bills: bills.created, photosDeleted });
}
