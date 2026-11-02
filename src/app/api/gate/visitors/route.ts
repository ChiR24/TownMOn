import { db } from "@/db";
import { Entry, logVisitor } from "@/lib/gate";
import { savePhoto } from "@/lib/photos";
import { denied, guardOnly, json } from "../guard";

/** A new visitor from the gate tablet: live, or replayed from its offline queue (same clientId -> recorded once). */
export async function POST(req: Request) {
  const user = await guardOnly(req);
  if (!user) return denied();
  const form = await req.formData();
  const parsed = Entry.safeParse(JSON.parse(String(form.get("entry") ?? "{}")));
  if (!parsed.success) return json({ error: "Check the flat number, name and purpose." }, 400);
  const photo = form.get("photo");
  const result = await db.transaction(async (tx) => {
    const photoId = photo instanceof File && photo.size > 0 ? await savePhoto(tx, photo) : null;
    return logVisitor(tx, parsed.data, user.id, photoId);
  });
  if ("error" in result) return json({ error: `There is no flat ${parsed.data.flatId}.` }, 400);
  return json(result);
}
