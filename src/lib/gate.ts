import { and, eq, gt, inArray, isNotNull, isNull, lt, lte } from "drizzle-orm";
import { z } from "zod";
import type { Q } from "@/db";
import { flats, guestCodes, notifications, photos, visitors } from "@/db/schema";
import { keyedHash, randomDigits, randomToken, sha256 } from "./crypto";
import { flatPeople } from "./data";
import { savePhoto } from "./photos";

export const PURPOSES = ["GUEST", "DELIVERY", "CAB", "SERVICE", "OTHER"] as const;
export const PHOTO_DAYS = 90; // DPDP: visitor photos are deleted after 90 days

const codeHash = (code: string) => keyedHash(`guest:${code}`);
export const offlineHashOf = (salt: string, code: string) => sha256(`${salt}:${code}`);

/** A resident creates a one-time code for an expected guest. The plain code is shown once and never stored. */
export async function createGuestCode(q: Q, { flatId, createdBy, guestName, hours, now = new Date() }: { flatId: string; createdBy: number; guestName: string; hours: number; now?: Date }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomDigits(6);
    // Two live codes must never collide, or a guard couldn't tell which flat a code belongs to.
    const [clash] = await q.select({ id: guestCodes.id }).from(guestCodes).where(and(eq(guestCodes.codeHash, codeHash(code)), isNull(guestCodes.usedAt), isNull(guestCodes.revokedAt), gt(guestCodes.validTo, now)));
    if (clash) continue;
    const salt = randomToken(8);
    const validTo = new Date(now.getTime() + hours * 3_600_000);
    const [g] = await q.insert(guestCodes).values({ flatId, createdBy, guestName, codeHash: codeHash(code), salt, offlineHash: offlineHashOf(salt, code), validFrom: now, validTo }).returning({ id: guestCodes.id });
    return { id: g.id, code, validTo };
  }
  throw new Error("Could not create a unique guest code");
}

/** Codes a gate tablet may check offline: live ones only, as salted hashes, never the codes themselves. */
export async function codesForTablet(q: Q, now = new Date()) {
  return q
    .select({ id: guestCodes.id, flatId: guestCodes.flatId, guestName: guestCodes.guestName, salt: guestCodes.salt, hash: guestCodes.offlineHash, validFrom: guestCodes.validFrom, validTo: guestCodes.validTo })
    .from(guestCodes)
    .where(and(isNull(guestCodes.usedAt), isNull(guestCodes.revokedAt), lte(guestCodes.validFrom, new Date(now.getTime() + 86_400_000)), gt(guestCodes.validTo, now)));
}

export const Entry = z.object({
  clientId: z.string().min(8).max(64),
  flatId: z.string().regex(/^T\d{2}-\d{4}$/),
  name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^[6-9]\d{9}$/).optional().or(z.literal("")),
  purpose: z.enum(PURPOSES),
  gate: z.number().int().min(1).max(4),
  arrivedAt: z.coerce.date(),
  // Filled in when the tablet was offline and the guard settled it on the intercom or with a code.
  outcome: z.enum(["PENDING", "INTERCOM_APPROVED", "INTERCOM_DENIED", "CODE"]).default("PENDING"),
  guestCodeId: z.number().int().optional(),
});
export type EntryInput = z.infer<typeof Entry>;

/**
 * Records a visitor at the gate. Idempotent on the tablet's clientId, so an entry synced twice after a network
 * drop is recorded once. A waiting visitor pings the household (in the app and, mocked, on WhatsApp).
 * The photo is stored only once the entry is known to be new, so a replay never leaves an extra copy of a face
 * that nothing points to (and that the 90-day purge would never find).
 */
export async function logVisitor(q: Q, e: EntryInput, guardId: number, photo: File | null) {
  const [existing] = await q.select({ id: visitors.id }).from(visitors).where(eq(visitors.clientId, e.clientId));
  if (existing) return { id: existing.id, duplicate: true };
  const [flat] = await q.select({ id: flats.id }).from(flats).where(eq(flats.id, e.flatId));
  if (!flat) return { error: "No such flat" as const };
  const photoId = photo ? await savePhoto(q, photo) : null;
  const settled = e.outcome !== "PENDING";
  const arrived = e.arrivedAt > new Date() ? new Date() : e.arrivedAt; // a tablet clock running fast can't create the future
  const [v] = await q
    .insert(visitors)
    .values({
      clientId: e.clientId,
      flatId: e.flatId,
      name: e.name,
      phone: e.phone || null,
      purpose: e.purpose,
      gate: e.gate,
      guardId,
      photoId,
      arrivedAt: arrived,
      status: e.outcome === "INTERCOM_DENIED" ? "DENIED" : settled ? "INSIDE" : "PENDING",
      approvalMode: e.outcome === "CODE" ? "CODE" : e.outcome.startsWith("INTERCOM") ? "INTERCOM" : null,
      guestCodeId: e.guestCodeId ?? null,
      decidedAt: settled ? arrived : null,
      enteredAt: settled && e.outcome !== "INTERCOM_DENIED" ? arrived : null,
    })
    .returning({ id: visitors.id });
  if (e.outcome === "CODE" && e.guestCodeId) await q.update(guestCodes).set({ usedAt: arrived }).where(and(eq(guestCodes.id, e.guestCodeId), isNull(guestCodes.usedAt)));
  if (!settled) {
    const people = await flatPeople(e.flatId, q);
    const text = `${e.name} is at Gate ${e.gate}`;
    if (people.length)
      await q.insert(notifications).values(
        people.flatMap((p) => [
          { userId: p.id, title: text, body: "Approve or deny in the app.", link: "/visitors" },
          { userId: p.id, channel: "WHATSAPP", title: text, body: "Open the Township app to let them in." },
        ]),
      );
  }
  return { id: v.id, duplicate: false };
}

/** A guard types a guest code (online). One use; only inside its window; then the guest is let straight in. */
export async function redeemCode(q: Q, code: string, gate: number, guardId: number, now = new Date()) {
  if (!/^\d{6}$/.test(code)) return { error: "invalid" as const };
  const [g] = await q.select().from(guestCodes).where(and(eq(guestCodes.codeHash, codeHash(code)), isNull(guestCodes.revokedAt))).orderBy(guestCodes.id);
  if (!g) return { error: "invalid" as const };
  if (g.usedAt) return { error: "used" as const };
  if (now < g.validFrom || now >= g.validTo) return { error: "expired" as const };
  const r = await logVisitor(q, { clientId: `code-${g.id}`, flatId: g.flatId, name: g.guestName, purpose: "GUEST", gate, arrivedAt: now, outcome: "CODE", guestCodeId: g.id, phone: "" }, guardId, null);
  return { ok: true as const, flatId: g.flatId, guestName: g.guestName, visitorId: "id" in r ? r.id : undefined };
}

/** DPDP: visitor photos go after 90 days. The visit record stays; the face doesn't. Run daily. */
export async function purgeVisitorPhotos(q: Q, now = new Date()) {
  const cutoff = new Date(now.getTime() - PHOTO_DAYS * 86_400_000);
  const old = await q.select({ id: visitors.id, photoId: visitors.photoId }).from(visitors).where(and(isNotNull(visitors.photoId), lt(visitors.arrivedAt, cutoff)));
  if (!old.length) return 0;
  await q.update(visitors).set({ photoId: null, photoPurgedAt: now }).where(inArray(visitors.id, old.map((o) => o.id)));
  await q.delete(photos).where(inArray(photos.id, old.map((o) => o.photoId!)));
  return old.length;
}
