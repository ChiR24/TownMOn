import type { Q } from "@/db";
import { photos } from "@/db/schema";

const MAX_BYTES = 2 * 1024 * 1024; // photos arrive already shrunk on the phone (≈150 KB); this is a hard ceiling

/** What the bytes actually are, whatever the browser claimed: JPEG, PNG or WebP only. */
function sniffImage(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** Stores an uploaded photo and returns its id, or null if it isn't a reasonable image. */
export async function savePhoto(q: Q, file: File): Promise<number | null> {
  if (file.size === 0 || file.size > MAX_BYTES) return null;
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(bytes);
  if (!mime) return null;
  // Photos live in Postgres (about 150 KB each). At full scale they would move to object storage with a 90-day expiry rule (TDD, A21).
  const [p] = await q.insert(photos).values({ mime, bytes }).returning({ id: photos.id });
  return p.id;
}
