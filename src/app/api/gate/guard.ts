import { AREAS, currentUser } from "@/lib/auth";

/** Gate API calls come only from our own pages (same origin) and only from a guard or the duty manager. */
export async function guardOnly(req: Request) {
  // Same origin = the page's host is the host this request was sent to, as Next checks its own server actions. Not
  // req.url: `next start` builds that from its own name, so a tablet on http://<LAN address>:3000 was refused.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (req.method !== "GET" && URL.parse(req.headers.get("origin") ?? "")?.host !== host) return null;
  const user = await currentUser();
  if (!user || !(AREAS.gate as readonly string[]).includes(user.role)) return null;
  return user;
}

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const denied = () => json({ error: "Not allowed" }, 403);
