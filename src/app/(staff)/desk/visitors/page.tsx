import { and, desc, eq, gte, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, cx, PageTitle, type Tone } from "@/components/ui";
import { db } from "@/db";
import { users, visitors } from "@/db/schema";
import { AREAS, requireUser } from "@/lib/auth";
import { fmtDateTime, startOfTodayIST } from "@/lib/dates";
import { findFlatCodes } from "@/lib/bank";

export const metadata: Metadata = { title: "Visitor log" };
const TONE: Record<string, Tone> = { PENDING: "amber", APPROVED: "teal", DENIED: "red", INSIDE: "emerald", LEFT: "zinc" };

export default async function VisitorLogPage({ searchParams }: { searchParams: Promise<{ gate?: string; flat?: string; days?: string }> }) {
  await requireUser(AREAS.desk);
  const sp = await searchParams;
  const gate = Number(sp.gate) || 0;
  const flat = sp.flat ? findFlatCodes(sp.flat)[0] : undefined;
  const days = sp.days === "7" ? 7 : 1;
  const since = days === 1 ? startOfTodayIST() : new Date(Date.now() - 7 * 86_400_000);
  const where: SQL[] = [gte(visitors.arrivedAt, since)];
  if (gate) where.push(eq(visitors.gate, gate));
  if (flat) where.push(eq(visitors.flatId, flat));
  const rows = await db.select({ v: visitors, guard: users.name }).from(visitors).innerJoin(users, eq(users.id, visitors.guardId)).where(and(...where)).orderBy(desc(visitors.arrivedAt)).limit(200);

  return (
    <div>
      <PageTitle title="Visitor log" subtitle="Every entry at the four gates. Photos are deleted automatically after 90 days." action={<Link href="/gate/notice" className="text-sm font-medium text-teal-800">Gate notice →</Link>} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <select name="gate" defaultValue={String(gate)} className="h-10 rounded-xl bg-white px-3 text-sm ring-1 ring-zinc-300" aria-label="Gate">
          <option value="0">All gates</option>
          {[1, 2, 3, 4].map((g) => (
            <option key={g} value={g}>
              Gate {g}
            </option>
          ))}
        </select>
        <input name="flat" defaultValue={flat ?? ""} placeholder="Flat, e.g. T07-1203" aria-label="Flat" className="h-10 rounded-xl bg-white px-3 text-sm ring-1 ring-zinc-300" />
        <select name="days" defaultValue={String(days)} className="h-10 rounded-xl bg-white px-3 text-sm ring-1 ring-zinc-300" aria-label="Period">
          <option value="1">Today</option>
          <option value="7">Last 7 days</option>
        </select>
        <button className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white">Show</button>
      </form>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200/80">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr className="border-b border-zinc-100">
              <th className="px-4 py-3 font-medium">Visitor</th>
              <th className="px-4 py-3 font-medium">Flat</th>
              <th className="px-4 py-3 font-medium">Gate</th>
              <th className="px-4 py-3 font-medium">Arrived</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">How</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map(({ v, guard }) => (
              <tr key={v.id}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {v.photoId ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private, access-checked photo route
                      <img src={`/api/photos/${v.photoId}`} alt="" className="size-8 rounded-lg object-cover" />
                    ) : (
                      <span className={cx("size-8 rounded-lg bg-zinc-100")} />
                    )}
                    <span>
                      <span className="block font-medium">{v.name}</span>
                      <span className="text-xs text-zinc-500">{v.purpose.toLowerCase()}</span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5">{v.flatId}</td>
                <td className="px-4 py-2.5">{v.gate}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-zinc-600">{fmtDateTime(v.arrivedAt)}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={TONE[v.status]}>{v.status.toLowerCase()}</Badge>
                </td>
                <td className="px-4 py-2.5 text-xs text-zinc-600">
                  {v.approvalMode === "CODE" ? "Guest code" : v.approvalMode === "INTERCOM" ? "Intercom" : v.approvalMode === "APP" ? "Resident in app" : "—"} · {guard}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
