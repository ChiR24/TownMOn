// Step 1: the 2,400 flats, everyone who lives in them, and the staff.
import { sql } from "drizzle-orm";
import { teamFor, type Category } from "../../lib/complaints";
import { db } from "../index";
import * as s from "../schema";
import { DEMO, MEN, person, STAFF, WOMEN } from "./cast";
import { ago, between, chance, chunked, pad, pick } from "./kit";

type Resident = { flatId: string; name: string; phone: string; relation: "OWNER" | "TENANT" | "FAMILY"; primary: boolean };

export async function seedPeople() {
  // 10 towers of 16 floors × 6 flats, 18 towers of 10 floors × 8 flats = 2,400
  const TYPE_A = new Set([1, 2, 3, 4, 5, 6, 7, 21, 22, 23]);
  const AREA_A = [1640, 1150, 1150, 1380, 980, 1640];
  const AREA_B = [1150, 980, 1150, 980, 1040, 980, 1060, 980];
  const flats: (typeof s.flats.$inferInsert)[] = [];
  for (let tower = 1; tower <= 28; tower++) {
    const a = TYPE_A.has(tower);
    for (let floor = 1; floor <= (a ? 16 : 10); floor++)
      for (let unit = 1; unit <= (a ? 6 : 8); unit++)
        flats.push({ id: `T${pad(tower)}-${pad(floor)}${pad(unit)}`, tower, floor, unit, areaSqft: (a ? AREA_A : AREA_B)[unit - 1] });
  }
  await chunked(flats, (part) => db.insert(s.flats).values(part).returning({ id: s.flats.id }));

  const residents: Resident[] = [];
  let serial = 1;
  for (const f of flats) {
    const demo = DEMO[f.id!];
    if (demo) {
      residents.push({ flatId: f.id!, name: demo.primary[0], phone: demo.primary[1], relation: demo.primary[2], primary: true });
      if (demo.owner) residents.push({ flatId: f.id!, name: demo.owner[0], phone: demo.owner[1], relation: "OWNER", primary: false });
      for (const [name, phone] of demo.family ?? []) residents.push({ flatId: f.id!, name, phone, relation: "FAMILY", primary: false });
      continue;
    }
    const tenanted = chance(0.16);
    residents.push({ flatId: f.id!, name: person(), phone: `97${pad(serial++, 8)}`, relation: tenanted ? "TENANT" : "OWNER", primary: true });
    if (tenanted) residents.push({ flatId: f.id!, name: person(), phone: `96${pad(serial++, 8)}`, relation: "OWNER", primary: false });
    if (chance(0.1)) {
      const surname = residents.at(-1)!.name.split(" ")[1];
      residents.push({ flatId: f.id!, name: `${pick(chance(0.5) ? WOMEN : MEN)} ${surname}`, phone: `95${pad(serial++, 8)}`, relation: "FAMILY", primary: false });
    }
  }
  const userRows = [
    ...STAFF.map((u) => ({ name: u.name, phone: u.phone, role: u.role, team: u.team ?? null, privacyAcceptedAt: ago(60 * 24 * 90) })),
    ...residents.map((r) => ({ name: r.name, phone: r.phone, role: "RESIDENT" as const, privacyAcceptedAt: chance(0.6) ? ago(60 * 24 * between(5, 90)) : null })),
  ];
  const userIds = await chunked(userRows, (part) => db.insert(s.users).values(part).returning({ id: s.users.id, phone: s.users.phone }));
  const uid = new Map(userIds.map((u) => [u.phone, u.id]));
  // Demo accounts accepted the privacy notice already, so a demo sign-in lands straight on the app.
  await db.update(s.users).set({ privacyAcceptedAt: ago(60 * 24 * 30) }).where(sql`phone like '980000000%'`);
  await chunked(
    residents.map((r) => ({ flatId: r.flatId, userId: uid.get(r.phone)!, relation: r.relation, isPrimary: r.primary })),
    (part) => db.insert(s.flatMembers).values(part).returning({ id: s.flatMembers.id }),
  );

  const staffId = (phone: string) => uid.get(phone)!;
  const techs = STAFF.filter((u) => u.role === "TECHNICIAN").map((u) => ({ id: staffId(u.phone), name: u.name, team: u.team! }));
  const techFor = (c: Category) => {
    const team = teamFor(c);
    const pool = techs.filter((t) => t.team === team);
    return pool.length ? pick(pool) : undefined;
  };
  return {
    flats,
    residents,
    uid,
    techFor,
    primaryOf: new Map(residents.filter((r) => r.primary).map((r) => [r.flatId, r])),
    staff: {
      HELPDESK: staffId("9800000010"),
      ACCOUNTS: staffId("9800000011"),
      COMMITTEE: staffId("9800000012"),
      MANAGER: staffId("9800000013"),
      GUARDS: [staffId("9800000014"), staffId("9800000015")],
    },
  };
}

export type Township = Awaited<ReturnType<typeof seedPeople>>;
