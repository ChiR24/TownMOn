import { and, desc, eq, gte, or } from "drizzle-orm";
import { db } from "@/db";
import { flats, visitors } from "@/db/schema";
import { startOfTodayIST } from "@/lib/dates";
import { codesForTablet } from "@/lib/gate";
import { denied, guardOnly, json } from "../guard";

/**
 * Everything a gate tablet needs, fetched every few seconds while online and cached for when it isn't:
 * today's entries at this gate, everyone still inside (from any gate: people leave by whichever gate is nearest),
 * live guest codes (as salted hashes) and, on request, the list of flats so the tablet can check a flat offline.
 */
export async function GET(req: Request) {
  const user = await guardOnly(req);
  if (!user) return denied();
  const url = new URL(req.url);
  const gate = Math.min(4, Math.max(1, Number(url.searchParams.get("gate")) || 1));
  const [entries, codes, flatList] = await Promise.all([
    db
      .select({ id: visitors.id, clientId: visitors.clientId, flatId: visitors.flatId, name: visitors.name, purpose: visitors.purpose, status: visitors.status, approvalMode: visitors.approvalMode, photoId: visitors.photoId, arrivedAt: visitors.arrivedAt, gate: visitors.gate })
      .from(visitors)
      .where(or(eq(visitors.status, "INSIDE"), and(eq(visitors.gate, gate), or(gte(visitors.arrivedAt, startOfTodayIST()), eq(visitors.status, "PENDING")))))
      .orderBy(desc(visitors.arrivedAt))
      .limit(80),
    codesForTablet(db),
    url.searchParams.get("flats") === "1" ? db.select({ id: flats.id }).from(flats).orderBy(flats.id) : Promise.resolve(null),
  ]);
  return json({ gate, now: new Date(), entries, codes, flats: flatList?.map((f) => f.id) });
}
