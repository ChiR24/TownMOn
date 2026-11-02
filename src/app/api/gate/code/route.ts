import { z } from "zod";
import { db } from "@/db";
import { redeemCode } from "@/lib/gate";
import { denied, guardOnly, json } from "../guard";

const Body = z.object({ code: z.string().regex(/^\d{6}$/), gate: z.number().int().min(1).max(4) });

export async function POST(req: Request) {
  const user = await guardOnly(req);
  if (!user) return denied();
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return json({ error: "invalid" }, 400);
  const r = await redeemCode(db, p.data.code, p.data.gate, user.id);
  return json(r, "error" in r ? 404 : 200);
}
