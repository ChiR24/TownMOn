// Step 3: six weeks of complaints, plus the open water leak in T12-0408, a ten-flat lift cluster and a gas emergency.
import { sql } from "drizzle-orm";
import { responseDue, type Category, type Urgency } from "../../lib/complaints";
import { db } from "../index";
import * as s from "../schema";
import { DEMO } from "./cast";
import { ago, between, chance, chunked, later, pick, rand } from "./kit";
import type { Township } from "./people";

const TEMPLATES: [Category, Urgency, string][] = [
  ["Plumbing", "MEDIUM", "Kitchen sink drain is blocked, water is not going down"],
  ["Plumbing", "MEDIUM", "Bathroom tap leaking continuously"],
  ["Plumbing", "MEDIUM", "बाथरूमच्या नळातून सतत पाणी गळत आहे"],
  ["Plumbing", "HIGH", "Water overflowing from the drain in the common passage"],
  ["Electrical", "MEDIUM", "Corridor light outside our flat not working for 3 days"],
  ["Electrical", "HIGH", "MCB keeps tripping, no power in two rooms"],
  ["Electrical", "MEDIUM", "स्विच बोर्ड ढीला है, पंखा बार-बार बंद हो जाता है"],
  ["Lift", "HIGH", "Lift B makes a grinding noise and stops between floors"],
  ["Lift", "HIGH", "लिफ्ट सकाळपासून बंद आहे"],
  ["Water supply", "HIGH", "No water in the taps since morning"],
  ["Water supply", "MEDIUM", "Very low water pressure on the top floors"],
  ["Water supply", "HIGH", "हमारे फ्लोर पर सुबह से पानी नहीं आ रहा है"],
  ["Cleaning", "LOW", "Garbage not collected from our floor today"],
  ["Cleaning", "MEDIUM", "जिन्यात खूप कचरा पडला आहे"],
  ["Security", "HIGH", "Unknown person roaming in the basement parking at night"],
  ["Parking", "MEDIUM", "Someone keeps parking in my allotted slot"],
  ["Parking", "MEDIUM", "पार्किंग में किसी ने मेरी गाड़ी के सामने बाइक खड़ी कर दी है"],
  ["Noise", "LOW", "Loud music from the flat above after 11 pm"],
  ["Pest control", "MEDIUM", "Cockroaches in the kitchen, need pest control"],
  ["Pest control", "LOW", "स्वयंपाकघरात झुरळे झाली आहेत"],
  ["Civil", "MEDIUM", "Seepage and a damp patch on the bedroom wall"],
  ["Civil", "LOW", "Crack in the plaster near the balcony door"],
  ["Garden", "LOW", "Tree branch touching our balcony, please trim it"],
];

type Row = typeof s.complaints.$inferInsert;
type Ev = { kind: string; note?: string; actorId?: number | null; createdAt: Date };
type Seed = {
  flatId: string;
  by: number;
  text: string;
  category: Category;
  urgency: Urgency;
  createdAt: Date;
  status: Row["status"];
  title?: string;
  via?: "AI" | "RULES" | "STAFF";
  confidence?: number;
  safety?: boolean;
  triage?: boolean;
  respondAfter?: number | null;
  resolveAfter?: number;
  closeAfter?: number;
  rating?: number;
  reopened?: boolean;
  key?: string;
  parentKey?: string;
  note?: string;
};

export async function seedComplaints({ residents, uid, techFor, staff: { HELPDESK, MANAGER } }: Township) {
  const primaries = residents.filter((r) => r.primary && !DEMO[r.flatId]);
  const rows: { row: Row; events: Ev[]; parentKey?: string; key?: string }[] = [];
  const by = (flatId: string) => uid.get(residents.find((x) => x.flatId === flatId && x.primary)!.phone)!;

  const add = (o: Seed) => {
    const tech = o.triage ? undefined : techFor(o.category);
    const via = o.via ?? (chance(0.82) ? "AI" : "RULES");
    // "STAFF": the AI wasn't sure, so it waited in triage and the help desk set the category.
    const conf = o.confidence ?? (via === "AI" ? between(72, 98) : via === "STAFF" ? between(30, 59) : null);
    const firstResponseAt = o.respondAfter == null || o.status === "OPEN" ? null : later(o.createdAt, o.respondAfter);
    const resolvedAt = o.status === "RESOLVED" || o.status === "CLOSED" ? later(o.createdAt, o.resolveAfter ?? between(120, 60 * 30)) : null;
    const closedAt = o.status === "CLOSED" && resolvedAt ? later(resolvedAt, o.closeAfter ?? between(30, 60 * 20)) : null;
    const events: Ev[] = [{ kind: "CREATED", actorId: o.by, createdAt: o.createdAt }];
    events.push({ kind: "CLASSIFIED", note: via === "RULES" ? `Rules: ${o.category} · ${o.urgency.toLowerCase()}` : `AI: ${via === "STAFF" ? "Other" : o.category} · ${o.urgency.toLowerCase()} · ${conf}% sure`, createdAt: later(o.createdAt, 0) });
    if (via === "STAFF") events.push({ kind: "CATEGORY", note: `Help desk set the category to ${o.category} (AI said Other, ${conf}% sure)`, actorId: HELPDESK, createdAt: later(o.createdAt, 1) });
    if (o.safety) events.push({ kind: "ESCALATED", note: "Safety words found. Duty manager Anil Jadhav alerted.", createdAt: later(o.createdAt, 0) });
    if (tech && o.status !== "OPEN") events.push({ kind: "ASSIGNED", note: `Assigned to ${tech.name}`, createdAt: later(o.createdAt, 1) });
    if (firstResponseAt) events.push({ kind: "STATUS", note: o.note ?? "Technician is on the way", actorId: o.safety ? MANAGER : HELPDESK, createdAt: firstResponseAt });
    if (o.reopened && resolvedAt) events.push({ kind: "REOPENED", note: "Resident says it is not fixed", actorId: o.by, createdAt: later(o.createdAt, between(60, 600)) });
    if (resolvedAt) events.push({ kind: "STATUS", note: "Marked resolved. Waiting for the resident to confirm.", actorId: HELPDESK, createdAt: resolvedAt });
    if (closedAt) events.push({ kind: "RATED", note: `${"★".repeat(o.rating ?? 5)} Rated ${o.rating ?? 5}/5`, actorId: o.by, createdAt: closedAt });
    rows.push({
      key: o.key,
      parentKey: o.parentKey,
      events,
      row: {
        flatId: o.flatId,
        raisedBy: o.by,
        description: o.text,
        title: o.title ?? null,
        category: o.category,
        urgency: o.urgency,
        classifiedBy: via,
        aiConfidence: conf,
        needsTriage: o.triage ?? false,
        safety: o.safety ?? false,
        status: o.status,
        assignedTo: o.status === "OPEN" ? null : (tech?.id ?? null),
        responseDueAt: responseDue(o.urgency, o.createdAt),
        firstResponseAt,
        resolvedAt,
        closedAt,
        rating: closedAt ? (o.rating ?? 5) : null,
        reopenCount: o.reopened ? 1 : 0,
        createdAt: o.createdAt,
      },
    });
  };

  // History: ~190 complaints over the last 45 days.
  for (let i = 0; i < 190; i++) {
    const [category, urgency, text] = pick(TEMPLATES);
    const r = primaries[Math.floor(rand() * primaries.length)];
    const minutes = between(60 * 3, 60 * 24 * 45);
    const createdAt = ago(minutes);
    const days = minutes / 60 / 24;
    const x = rand();
    const status: Row["status"] = days > 7 ? "CLOSED" : days > 3 ? (x < 0.75 ? "CLOSED" : "RESOLVED") : days > 1 ? (x < 0.4 ? "CLOSED" : x < 0.6 ? "RESOLVED" : "IN_PROGRESS") : x < 0.5 ? "ASSIGNED" : "IN_PROGRESS";
    const sla = { EMERGENCY: 15, HIGH: 60, MEDIUM: 240, LOW: 1440 }[urgency];
    const g = rand();
    add({
      flatId: r.flatId,
      by: uid.get(r.phone)!,
      text,
      category,
      urgency,
      createdAt,
      status,
      via: chance(0.06) ? "STAFF" : undefined,
      respondAfter: status === "ASSIGNED" && chance(0.5) ? null : chance(0.86) ? between(5, sla) : between(sla + 10, sla * 3),
      rating: g < 0.45 ? 5 : g < 0.75 ? 4 : g < 0.87 ? 3 : g < 0.95 ? 2 : 1,
      reopened: (status === "CLOSED" || status === "RESOLVED") && chance(0.11),
    });
  }

  // The open complaint in T12-0408: a water leak.
  add({
    flatId: "T12-0408",
    by: uid.get("9800000002")!,
    text: "Water leaking from the bathroom ceiling, coming from the flat above. The false ceiling panel is wet.",
    title: "Bathroom ceiling leak from flat above",
    category: "Plumbing",
    urgency: "MEDIUM",
    createdAt: ago(60 * 24 * 2 + 140),
    status: "IN_PROGRESS",
    via: "AI",
    confidence: 94,
    respondAfter: 50,
    note: "Plumber checked T12-0508 above. Pipe joint to be replaced tomorrow, 11 am.",
  });
  // Neeraj's closed complaint from last month.
  add({ flatId: "T07-1203", by: uid.get("9800000001")!, text: "Bathroom tap leaking continuously", title: "Bathroom tap leaking", category: "Plumbing", urgency: "MEDIUM", createdAt: ago(60 * 24 * 24), status: "CLOSED", via: "AI", confidence: 97, respondAfter: 35, resolveAfter: 300, rating: 5 });

  // Ten flats reporting the same lift: one parent, nine linked duplicates.
  const t14 = ["T14-0802", "T14-0305", "T14-0601", "T14-0907", "T14-1004", "T14-0203", "T14-0708", "T14-0502", "T14-1006", "T14-0404"];
  const liftTexts = ["Lift A in T14 not working since morning. Elderly residents on the upper floors can't go down.", "T14 lift not working", "लिफ्ट बंद आहे, कोणी तरी बघा", "Lift down again!!", "Is anyone fixing the lift in T14?", "लिफ्ट काम नहीं कर रही है", "Lift A not working", "Lift not coming to 7th floor", "T14 lift stopped", "Lift A out of order since 8 am"];
  t14.forEach((flatId, i) => {
    add({
      flatId,
      by: by(flatId),
      text: liftTexts[i],
      title: i === 0 ? "Lift A in T14 not working" : undefined,
      category: "Lift",
      urgency: "HIGH",
      createdAt: ago(185 - i * 15),
      status: i === 0 ? "IN_PROGRESS" : "ASSIGNED",
      via: "AI",
      confidence: between(88, 97),
      respondAfter: i === 0 ? 22 : null,
      key: i === 0 ? "lift" : undefined,
      parentKey: i === 0 ? undefined : "lift",
      note: i === 0 ? "Lift vendor called. Technician on site by 11 am." : undefined,
    });
  });
  // Safety escalation, a breach in the making and one the AI wasn't sure about.
  add({ flatId: "T09-0104", by: by("T09-0104"), text: "Strong smell of gas near the meter room on the ground floor of T09", title: "Gas smell near T09 meter room", category: "Security", urgency: "EMERGENCY", createdAt: ago(40), status: "IN_PROGRESS", via: "AI", confidence: 88, safety: true, respondAfter: 6, note: "Duty manager on site, gas supplier called, area cordoned off." });
  add({ flatId: "T03-0502", by: by("T03-0502"), text: "आमच्या मजल्यावर सकाळपासून पाणी नाही", title: "No water on the floor since morning", category: "Water supply", urgency: "HIGH", createdAt: ago(95), status: "ASSIGNED", via: "AI", confidence: 93, respondAfter: null });
  add({ flatId: "T05-0903", by: by("T05-0903"), text: "Same problem as last week, nobody came. Please check again.", category: "Other", urgency: "MEDIUM", createdAt: ago(25), status: "OPEN", via: "AI", confidence: 34, triage: true, respondAfter: null });

  const ids = await chunked(rows.map((r) => r.row), (part) => db.insert(s.complaints).values(part).returning({ id: s.complaints.id }), 400);
  const byKey = new Map(rows.flatMap((r, i) => (r.key ? [[r.key, ids[i].id] as const] : [])));
  for (const [i, r] of rows.entries())
    if (r.parentKey) {
      const parentId = byKey.get(r.parentKey)!;
      await db.update(s.complaints).set({ parentId }).where(sql`id = ${ids[i].id}`);
      r.events.push({ kind: "LINKED", note: `Linked to #${parentId}: same lift. Updates on #${parentId} reach this complaint too.`, createdAt: later(r.row.createdAt as Date, 1) });
    }
  const events = rows.flatMap((r, i) => r.events.map((e) => ({ complaintId: ids[i].id, actorId: e.actorId ?? null, kind: e.kind, note: e.note ?? null, createdAt: e.createdAt })));
  await chunked(events, (part) => db.insert(s.complaintEvents).values(part).returning({ id: s.complaintEvents.id }));
}
