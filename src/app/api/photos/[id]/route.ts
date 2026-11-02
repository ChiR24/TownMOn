import { eq } from "drizzle-orm";
import { db } from "@/db";
import { complaints, photos, visitors } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { isMember } from "@/lib/data";

const STAFF_FOR_COMPLAINTS = ["HELPDESK", "MANAGER"];
const STAFF_FOR_VISITORS = ["GUARD", "MANAGER", "HELPDESK"];

/** Photos are personal data: served only to the flat's residents or the staff who need them, never cached publicly. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const id = Number((await params).id);
  if (!user || !Number.isInteger(id)) return new Response("Not found", { status: 404 });

  const [c] = await db.select({ flatId: complaints.flatId }).from(complaints).where(eq(complaints.photoId, id));
  const [v] = c ? [] : await db.select({ flatId: visitors.flatId }).from(visitors).where(eq(visitors.photoId, id));
  const owner = c ?? v;
  const staffOk = (c && STAFF_FOR_COMPLAINTS.includes(user.role)) || (v && STAFF_FOR_VISITORS.includes(user.role));
  if (!owner || !(staffOk || (user.role === "RESIDENT" && (await isMember(user.id, owner.flatId))))) return new Response("Not found", { status: 404 });

  const [p] = await db.select({ mime: photos.mime, bytes: photos.bytes }).from(photos).where(eq(photos.id, id));
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(p.bytes), {
    headers: { "Content-Type": p.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
