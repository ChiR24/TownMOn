import { and, desc, eq, gte, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, Badge, Button, fieldCls, PageTitle, Select, type Tone } from "@/components/ui";
import { db } from "@/db";
import { users, visitors } from "@/db/schema";
import { AREAS, requireUser } from "@/lib/auth";
import { daysAgo, fmtDateTime, startOfTodayIST } from "@/lib/dates";
import { findFlatCodes } from "@/lib/bank";

export const metadata: Metadata = { title: "Visitor log" };
// The same words the residents and the gate use.
const STATUS: Record<string, [string, Tone]> = { PENDING: ["Waiting", "amber"], APPROVED: ["Approved", "brand"], DENIED: ["Denied", "red"], INSIDE: ["Inside", "emerald"], LEFT: ["Left", "zinc"] };
const PURPOSE: Record<string, string> = { GUEST: "Guest", DELIVERY: "Delivery", CAB: "Cab", SERVICE: "Service", OTHER: "Other" };
const HOW: Record<string, string> = { CODE: "Guest code", INTERCOM: "Intercom", APP: "Resident in app" };

export default async function VisitorLogPage({ searchParams }: { searchParams: Promise<{ gate?: string; flat?: string; days?: string }> }) {
  await requireUser(AREAS.desk);
  const sp = await searchParams;
  const gate = Number(sp.gate) || 0;
  const flat = sp.flat ? findFlatCodes(sp.flat)[0] : undefined;
  const days = sp.days === "7" ? 7 : 1;
  const since = days === 1 ? startOfTodayIST() : daysAgo(7);
  const where: SQL[] = [gte(visitors.arrivedAt, since)];
  if (gate) where.push(eq(visitors.gate, gate));
  if (flat) where.push(eq(visitors.flatId, flat));
  const rows = await db.select({ v: visitors, guard: users.name }).from(visitors).innerJoin(users, eq(users.id, visitors.guardId)).where(and(...where)).orderBy(desc(visitors.arrivedAt)).limit(200);

  return (
    <div>
      <PageTitle title="Visitor log" subtitle="Every entry at the four gates. Photos are deleted automatically after 90 days." action={<Link href="/gate/notice" className="text-sm font-medium text-accent-ink">Gate notice →</Link>} />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <Select compact name="gate" defaultValue={String(gate)} aria-label="Gate">
          <option value="0">All gates</option>
          {[1, 2, 3, 4].map((g) => (
            <option key={g} value={g}>
              Gate {g}
            </option>
          ))}
        </Select>
        <input name="flat" defaultValue={flat ?? ""} placeholder="Flat, e.g. T07-1203" aria-label="Flat" className={fieldCls} />
        <Select compact name="days" defaultValue={String(days)} aria-label="Period">
          <option value="1">Today</option>
          <option value="7">Last 7 days</option>
        </Select>
        <Button type="submit" size="sm">
          Show
        </Button>
      </form>
      <div className="overflow-x-auto card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">Visitor</th>
              <th className="px-4 py-3 font-medium">Flat</th>
              <th className="px-4 py-3 font-medium">Gate</th>
              <th className="px-4 py-3 font-medium">Arrived</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">How</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ v, guard }) => (
              <tr key={v.id}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    {v.photoId ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private, access-checked photo route
                      <img src={`/api/photos/${v.photoId}`} alt="" className="size-8 rounded-full object-cover" />
                    ) : (
                      <Avatar name={v.name} className="size-8 text-xs" />
                    )}
                    <span>
                      <span className="block font-medium">{v.name}</span>
                      <span className="text-xs text-ink-3">{PURPOSE[v.purpose]}</span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5">{v.flatId}</td>
                <td className="px-4 py-2.5">{v.gate}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{fmtDateTime(v.arrivedAt)}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={STATUS[v.status][1]}>{STATUS[v.status][0]}</Badge>
                </td>
                <td className="px-4 py-2.5 text-xs text-ink-2">
                  {v.approvalMode ? `${HOW[v.approvalMode]} · ${guard}` : guard}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
