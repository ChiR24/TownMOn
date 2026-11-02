import { db } from "@/db";
import { AREAS, currentUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { todayIST } from "@/lib/dates";
import { sampleStatement } from "@/lib/sample-statement";

export async function GET() {
  const user = await currentUser();
  if (!DEMO_MODE || !user || !(AREAS.accounts as readonly string[]).includes(user.role)) return new Response("Not found", { status: 404 });
  return new Response(await sampleStatement(db), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="HDFC-statement-${todayIST()}.csv"`, "Cache-Control": "no-store" },
  });
}
