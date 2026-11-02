import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { visitors } from "@/db/schema";
import { denied, guardOnly, json } from "../../guard";

const Action = z.object({ action: z.enum(["enter", "left", "intercom-approve", "intercom-deny"]) });

/** The guard lets an approved visitor in, marks them gone, or settles a no-answer on the intercom. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guardOnly(req);
  if (!user) return denied();
  const id = Number((await params).id);
  const parsed = Action.safeParse(await req.json().catch(() => ({})));
  if (!Number.isInteger(id) || !parsed.success) return json({ error: "Bad request" }, 400);
  const now = new Date();
  const where = (from: ("PENDING" | "APPROVED" | "INSIDE")[]) => and(eq(visitors.id, id), inArray(visitors.status, from));
  const a = parsed.data.action;
  const [done] =
    a === "enter"
      ? await db.update(visitors).set({ status: "INSIDE", enteredAt: now }).where(where(["APPROVED"])).returning({ id: visitors.id })
      : a === "left"
        ? await db.update(visitors).set({ status: "LEFT", leftAt: now }).where(where(["INSIDE"])).returning({ id: visitors.id })
        : await db
            .update(visitors)
            .set(a === "intercom-approve" ? { status: "INSIDE", approvalMode: "INTERCOM", decidedAt: now, enteredAt: now } : { status: "DENIED", approvalMode: "INTERCOM", decidedAt: now })
            .where(where(["PENDING"]))
            .returning({ id: visitors.id });
  return done ? json({ ok: true }) : json({ error: "This visitor's status has already changed." }, 409);
}
