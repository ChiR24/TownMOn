import { db } from "@/db";
import { Entry, logVisitor } from "@/lib/gate";
import { denied, guardOnly, json } from "../guard";

/** A new visitor from the gate tablet: live, or replayed from its offline queue (same clientId -> recorded once). */
export async function POST(req: Request) {
  const user = await guardOnly(req);
  if (!user) return denied();
  const form = await req.formData();
  let entry: unknown;
  try {
    entry = JSON.parse(String(form.get("entry") ?? "{}"));
  } catch {
    entry = null;
  }
  const parsed = Entry.safeParse(entry);
  if (!parsed.success) return json({ error: "Check the flat number, name and purpose." }, 400);
  const photo = form.get("photo");
  const result = await db.transaction((tx) => logVisitor(tx, parsed.data, user.id, photo instanceof File && photo.size > 0 ? photo : null));
  if ("error" in result) return json({ error: `There is no flat ${parsed.data.flatId}.` }, 400);
  return json(result);
}
