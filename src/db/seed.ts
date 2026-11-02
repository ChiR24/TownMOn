/*
 * Seeds a realistic township: 28 towers, 2,400 flats, four months of bills and payments run through the
 * real billing engine, a bank import history, complaints, visitors, amenity bookings and notices.
 * Deterministic (fixed random seed) and relative to today, so the demo always looks current.
 *
 *   npm run db:seed             reset and seed
 *   tsx src/db/seed.ts --if-empty     seed only if there is no data (runs before `npm run dev`)
 *   tsx src/db/seed.ts --migrate-only
 */
import { deflateSync, crc32 } from "node:zlib";
import { count, sql } from "drizzle-orm";
import { migrate as pgMigrate } from "drizzle-orm/node-postgres/migrator";
import { migrate as liteMigrate } from "drizzle-orm/pglite/migrator";
import { billFor, type Charge, type Credit } from "../lib/billing";
import { responseDue, teamFor, type Category, type Urgency } from "../lib/complaints";
import { keyedHash, sha256 } from "../lib/crypto";
import { addDays, fmtDate, fmtMonth, shiftPeriod, todayIST } from "../lib/dates";
import { sum } from "../lib/money";
import { BANKS, narrationFor, refFor, vpaFor, type Bank } from "../lib/narrations";
import { db } from "./index";
import * as s from "./schema";

// ---------- deterministic randomness and time ----------
let state = 20261102;
function rand() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pad = (n: number, w = 2) => String(n).padStart(w, "0");

const now = new Date();
const today = todayIST(now);
const PERIOD = today.slice(0, 7);
const PERIODS = [-3, -2, -1, 0].map((n) => shiftPeriod(PERIOD, n));
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:30`);
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const later = (d: Date, minutes: number) => new Date(Math.min(d.getTime() + minutes * 60_000, now.getTime()));

async function chunked<T, R>(rows: T[], insert: (part: T[]) => Promise<R[]>, size = 800): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < rows.length; i += size) out.push(...(await insert(rows.slice(i, i + size))));
  return out;
}

// ---------- people ----------
const MEN = ["Aditya", "Amit", "Anand", "Abhijit", "Ashish", "Deepak", "Ganesh", "Harish", "Kiran", "Mahesh", "Manoj", "Nikhil", "Omkar", "Pankaj", "Prasad", "Rahul", "Rajesh", "Sachin", "Sameer", "Sandeep", "Shrikant", "Sunil", "Tushar", "Vikas", "Vinay", "Yogesh", "Imran", "Farhan", "Joseph", "Arjun", "Karthik", "Venkat", "Rohit", "Saurabh", "Hemant", "Girish"];
const WOMEN = ["Aarti", "Anjali", "Ashwini", "Deepa", "Gauri", "Kavita", "Madhuri", "Manasi", "Neha", "Pooja", "Priya", "Rashmi", "Shweta", "Smita", "Sneha", "Sonali", "Supriya", "Varsha", "Vaishali", "Zainab", "Fatima", "Mary", "Lakshmi", "Divya", "Ketaki", "Mrunal"];
const SURNAMES = ["Patil", "Kulkarni", "Deshpande", "Joshi", "Jadhav", "Pawar", "Shinde", "Kale", "Gokhale", "Apte", "Bhide", "Kamat", "Naik", "Sawant", "Chavan", "Desai", "Mehta", "Shah", "Iyer", "Nair", "Reddy", "Gupta", "Sharma", "Verma", "Khan", "Shaikh", "Sayyad", "Dsouza", "Fernandes", "Agarwal", "Mishra", "Kapoor", "Bhosale", "Gaikwad", "More", "Mane", "Thakur", "Rane", "Ghosh", "Banerjee"];
const person = () => `${pick(chance(0.45) ? WOMEN : MEN)} ${pick(SURNAMES)}`;

const STAFF: { name: string; phone: string; role: (typeof s.role.enumValues)[number]; team?: Category }[] = [
  { name: "Rohan Patil", phone: "9800000010", role: "HELPDESK" },
  { name: "Sunita Deshmukh", phone: "9800000011", role: "ACCOUNTS" },
  { name: "Col. Vijay Rao (retd.)", phone: "9800000012", role: "COMMITTEE" },
  { name: "Anil Jadhav", phone: "9800000013", role: "MANAGER" },
  { name: "Ramesh Pawar", phone: "9800000014", role: "GUARD" },
  { name: "Sanjay More", phone: "9800000015", role: "GUARD" },
  ...(
    [
      ["Ganesh Shinde", "Plumbing"],
      ["Mahesh Kale", "Plumbing"],
      ["Suresh Gaikwad", "Plumbing"],
      ["Prakash Bhosale", "Electrical"],
      ["Ajay Salunkhe", "Electrical"],
      ["Kiran Mane (lift vendor)", "Lift"],
      ["Rahul Thorat (lift vendor)", "Lift"],
      ["Raju Waghmare (pump room)", "Water supply"],
      ["Lata Kamble", "Cleaning"],
      ["Savita Sathe", "Cleaning"],
      ["Manoj Gaikwad", "Cleaning"],
      ["Vikram Thorat (security)", "Security"],
      ["Santosh Jagtap", "Civil"],
      ["Nitin Kadam", "Civil"],
      ["Babu Shaikh", "Garden"],
      ["Amol (pest control)", "Pest control"],
    ] as const
  ).map(([name, team], i) => ({ name, phone: `98000001${pad(i)}`, role: "TECHNICIAN" as const, team })),
];

type Plan = { day: number; part?: number; amount?: number; method?: Method } | null;
type Method = "UPI" | "NEFT" | "IMPS" | "CHEQUE" | "GATEWAY";
type Demo = { primary: [string, string, "OWNER" | "TENANT"]; owner?: [string, string]; family?: [string, string][]; vpa?: string; method: Method; plan: (i: number) => Plan };

// The three reference flats, exact to the rupee.
const DEMO: Record<string, Demo> = {
  "T07-1203": {
    primary: ["Neeraj Kulkarni", "9800000001", "OWNER"],
    family: [["Meera Kulkarni", "9800000004"]],
    vpa: "neeraj.kulkarni@okhdfcbank",
    method: "UPI",
    plan: (i) => (i < 3 ? { day: 3 } : { day: 1, method: "GATEWAY" }), // paid ₹7,475 this month, 0 days overdue
  },
  "T12-0408": {
    primary: ["Swati Joshi", "9800000002", "TENANT"],
    owner: ["Prakash Deshpande", "9600000408"],
    vpa: "swati.joshi@okicici",
    method: "NEFT",
    plan: (i) => (i === 0 ? { day: 8 } : null), // nothing paid since: ~47 days overdue, one open water-leak complaint
  },
  "T21-1601": {
    primary: ["Aamir Shaikh", "9800000003", "OWNER"],
    method: "IMPS",
    plan: (i) => (i < 2 ? { day: 6 } : i === 2 ? { day: 20, amount: 500_000 } : null), // ₹5,000 of ₹10,660: 18 days overdue
  },
};

function placeholderPhoto(size = 64) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit greyscale
  const raw = Buffer.alloc((size + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) raw[y * (size + 1) + 1 + x] = Math.min(230, 90 + Math.round((140 * Math.hypot(x - size / 2, y - size / 2.6)) / size));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- entry ----------
async function migrate() {
  const cfg = { migrationsFolder: "drizzle" };
  if (process.env.DATABASE_URL) await pgMigrate(db, cfg);
  else await liteMigrate(db as never, cfg);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  await migrate();
  if (args.has("--migrate-only")) return;
  if (args.has("--if-empty")) {
    const [{ n }] = await db.select({ n: count() }).from(s.users);
    if (n > 0) return;
  }
  const started = Date.now();
  await reset();
  await seed();
  console.log(`Seeded in ${((Date.now() - started) / 1000).toFixed(1)}s. Demo logins are listed on the sign-in page.`);
}

async function reset() {
  const tables = [
    "audit_log", "notifications", "sessions", "otp_challenges", "notices", "bookings", "amenities", "visitors", "guest_codes",
    "complaint_events", "complaints", "photos", "payer_accounts", "bank_txns", "bank_imports", "gateway_orders", "ledger",
    "payments", "bills", "flat_members", "flats", "users",
  ];
  await db.execute(sql.raw(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`));
}

async function seed() {
  // ---- flats: 10 towers of 16 floors × 6 flats, 18 towers of 10 floors × 8 flats = 2,400 ----
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

  // ---- people ----
  type Resident = { flatId: string; name: string; phone: string; relation: "OWNER" | "TENANT" | "FAMILY"; primary: boolean };
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
  const HELPDESK = staffId("9800000010"), ACCOUNTS = staffId("9800000011"), COMMITTEE = staffId("9800000012"), MANAGER = staffId("9800000013");
  const GUARDS = [staffId("9800000014"), staffId("9800000015")];
  const techs = STAFF.filter((u) => u.role === "TECHNICIAN").map((u) => ({ id: staffId(u.phone), name: u.name, team: u.team! }));
  const techFor = (c: Category) => {
    const team = teamFor(c);
    const pool = techs.filter((t) => t.team === team);
    return pool.length ? pick(pool) : undefined;
  };
  const primaryOf = new Map(residents.filter((r) => r.primary).map((r) => [r.flatId, r]));

  // ---- four months of bills and payments, through the real billing engine ----
  type PayRow = typeof s.payments.$inferInsert & { _flat: string; _bank: Bank; _withFlat: boolean; _method: Method };
  const billRows: (typeof s.bills.$inferInsert)[] = [];
  const payRows: PayRow[] = [];
  const arrearsRows: (typeof s.ledger.$inferInsert)[] = [];
  const learnedVpa: { vpa: string; flatId: string }[] = [];
  let paySerial = 1;

  for (const f of flats) {
    const flatId = f.id!;
    const demo = DEMO[flatId];
    const name = primaryOf.get(flatId)!.name;
    const bank = pick(BANKS);
    const r = rand();
    const profile = r < 0.7 ? "ontime" : r < 0.86 ? "late" : r < 0.91 ? "partial" : r < 0.96 ? "skipper" : "defaulter";
    const m = rand();
    const method: Method = demo?.method ?? (m < 0.5 ? "UPI" : m < 0.72 ? "GATEWAY" : m < 0.84 ? "NEFT" : m < 0.92 ? "CHEQUE" : "IMPS");
    const vpa = demo?.vpa ?? vpaFor(name, bank, paySerial);
    if (method === "UPI" && (demo || chance(0.75))) learnedVpa.push({ vpa, flatId });
    const skipIdx = between(0, 3);
    const stopIdx = between(0, 2);
    const plan = (i: number): Plan => {
      if (demo) return demo.plan(i);
      if (profile === "ontime") return { day: between(1, 12) };
      if (profile === "late") return { day: between(17, 28) };
      if (profile === "partial") return { day: between(3, 20), part: 0.5 };
      if (profile === "skipper") return i === skipIdx ? null : { day: between(2, 14) };
      return i < stopIdx ? { day: between(10, 28) } : null;
    };

    const charges: Charge[] = [];
    const credits: Credit[] = [];
    if (profile === "defaulter" && !demo && chance(0.6)) {
      const months = between(2, 4);
      const amount = f.areaSqft! * 650 * months;
      const date = addDays(`${PERIODS[0]}-01`, -1);
      charges.push({ kind: "MAINTENANCE", amount, date, dueDate: `${shiftPeriod(PERIODS[0], -months)}-15` });
      arrearsRows.push({ flatId, kind: "MAINTENANCE", amount, date, dueDate: `${shiftPeriod(PERIODS[0], -months)}-15`, memo: `Arrears brought forward (${months} months)` });
    }
    PERIODS.forEach((period, i) => {
      const bill = billFor(period, f.areaSqft!, charges, credits);
      billRows.push({ flatId, period, ...bill, areaSqft: f.areaSqft!, ratePaise: 650 });
      charges.push({ kind: "MAINTENANCE", amount: bill.maintenance, date: bill.billDate, dueDate: bill.dueDate });
      if (bill.interest) charges.push({ kind: "INTEREST", amount: bill.interest, date: bill.billDate, dueDate: bill.dueDate });
      const p = plan(i);
      if (!p) return;
      const paidOn = `${period}-${pad(p.day)}`;
      if (paidOn > today) return;
      const owed = sum(charges.map((c) => c.amount)) - sum(credits.map((c) => c.amount));
      if (owed <= 0) return;
      const amount = p.amount ?? (p.part ? Math.max(100_00, Math.round((owed * p.part) / 100_00) * 100_00) : owed);
      credits.push({ amount, date: paidOn });
      const how = p.method ?? method;
      const gateway = how === "GATEWAY";
      const ref = refFor(gateway ? "UPI" : how, bank, paidOn, paySerial++);
      payRows.push({
        flatId,
        amount,
        method: gateway ? pick(["UPI", "UPI", "UPI", "CARD", "NETBANKING"] as const) : how,
        source: gateway ? "GATEWAY" : "BANK",
        paidOn,
        reference: gateway ? `pay_${sha256(`${flatId}${paidOn}`).slice(0, 14)}` : ref,
        gatewayPaymentId: gateway ? `pay_${sha256(`${flatId}${paidOn}`).slice(0, 14)}` : null,
        payerVpa: how === "UPI" ? vpa : null,
        payerName: name,
        createdAt: at(paidOn, `${pad(between(7, 21))}:${pad(between(0, 59))}`),
        _flat: flatId,
        _bank: bank,
        _withFlat: how === "UPI" ? chance(0.6) : how === "IMPS" ? chance(0.5) : how === "NEFT" ? chance(0.3) : false,
        _method: how,
      });
    });
  }

  const billIds = await chunked(billRows, (part) => db.insert(s.bills).values(part).returning({ id: s.bills.id }));
  const payIds = await chunked(
    payRows.map(({ _flat, _bank, _withFlat, _method, ...p }) => p),
    (part) => db.insert(s.payments).values(part).returning({ id: s.payments.id }),
  );

  const ledgerRows: (typeof s.ledger.$inferInsert)[] = [...arrearsRows];
  billRows.forEach((b, i) => {
    ledgerRows.push({ flatId: b.flatId, kind: "MAINTENANCE", amount: b.maintenance, date: b.billDate, dueDate: b.dueDate, billId: billIds[i].id, memo: `Maintenance for ${fmtMonth(b.period)}` });
    if (b.interest) ledgerRows.push({ flatId: b.flatId, kind: "INTEREST", amount: b.interest!, date: b.billDate, dueDate: b.dueDate, billId: billIds[i].id, memo: "Interest on overdue maintenance" });
  });
  payRows.forEach((p, i) => ledgerRows.push({ flatId: p.flatId, kind: "PAYMENT", amount: -p.amount, date: p.paidOn, paymentId: payIds[i].id, memo: p.source === "GATEWAY" ? "Paid in the app" : `${p.method} received` }));
  await chunked(ledgerRows, (part) => db.insert(s.ledger).values(part).returning({ id: s.ledger.id }));

  // ---- online payments: gateway orders, settled to the bank the next day ----
  const orders = payRows.flatMap((p, i) =>
    p.source === "GATEWAY"
      ? [{ id: `order_${sha256(`o${payIds[i].id}`).slice(0, 14)}`, flatId: p.flatId, amount: p.amount, status: "PAID" as const, createdBy: uid.get(primaryOf.get(p.flatId)!.phone)!, paymentId: payIds[i].id, settlementId: `setl_${addDays(p.paidOn, 1).replaceAll("-", "")}`, createdAt: p.createdAt, paidAt: p.createdAt }]
      : [],
  );
  await chunked(orders, (part) => db.insert(s.gatewayOrders).values(part).returning({ id: s.gatewayOrders.id }));

  // ---- bank imports for last month and this month so far ----
  for (const period of [PERIODS[2], PERIODS[3]]) {
    const bankPays = payRows.map((p, i) => ({ p, id: payIds[i].id })).filter(({ p }) => p.source === "BANK" && p.paidOn.startsWith(period));
    if (!bankPays.length) continue;
    const importedAt = period === PERIOD ? ago(180) : new Date(Math.min(at(`${PERIOD}-01`, "10:30").getTime(), ago(120).getTime()));
    const known = new Set(learnedVpa.map((l) => l.vpa));
    const txns = bankPays.map(({ p, id }) => {
      const narration = narrationFor({ method: p._method as "UPI", name: p.payerName!, vpa: p.payerVpa ?? undefined, bank: p._bank, flatId: p.flatId, withFlat: p._withFlat, ref: p.reference! });
      const auto = p._withFlat || (p.payerVpa != null && known.has(p.payerVpa));
      return {
        importId: 0,
        fingerprint: sha256(`${p.paidOn}|${narration}|${p.amount}`),
        txnDate: p.paidOn,
        narration,
        refNo: p.reference,
        amount: p.amount,
        method: p.method,
        payerVpa: p.payerVpa,
        payerName: p.payerName,
        utr: p.reference,
        status: auto ? ("AUTO_MATCHED" as const) : ("MATCHED" as const),
        confidence: auto ? between(85, 100) : between(20, 60),
        reasons: auto ? [p._withFlat ? `Payment note says ${p.flatId}` : `UPI ID ${p.payerVpa} has paid for ${p.flatId} before`, "Amount equals the full dues"] : ["Matched by accounts"],
        suggestions: [],
        flatId: p.flatId,
        paymentId: id,
        resolvedBy: auto ? null : ACCOUNTS,
        resolvedAt: auto ? importedAt : later(importedAt, between(4, 90)),
        createdAt: importedAt,
      };
    });
    const [imp] = await db
      .insert(s.bankImports)
      .values({
        fileName: `HDFC-statement-${period}.csv`,
        uploadedBy: ACCOUNTS,
        rows: txns.length,
        credits: txns.length,
        autoMatched: txns.filter((t) => t.status === "AUTO_MATCHED").length,
        needsReview: txns.filter((t) => t.status === "MATCHED").length,
        createdAt: importedAt,
      })
      .returning({ id: s.bankImports.id });
    await chunked(txns.map((t) => ({ ...t, importId: imp.id })), (part) => db.insert(s.bankTxns).values(part).returning({ id: s.bankTxns.id }));
  }
  await db.execute(sql`update payments set bank_txn_id = b.id from bank_txns b where b.payment_id = payments.id`);
  await chunked(learnedVpa, (part) => db.insert(s.payerAccounts).values(part).returning({ id: s.payerAccounts.id }));

  // ---- complaints ----
  await seedComplaints({ residents, uid, techFor, HELPDESK, MANAGER });

  // ---- visitors and guest codes ----
  const neeraj = uid.get("9800000001")!;
  const [usedCode, liveCode] = await db
    .insert(s.guestCodes)
    .values([
      { flatId: "T07-1203", createdBy: neeraj, codeHash: keyedHash("guest:482913"), guestName: "Asha (cook)", validFrom: ago(60 * 6), validTo: ago(60 * 2), usedAt: ago(60 * 5) },
      { flatId: "T07-1203", createdBy: neeraj, codeHash: keyedHash("guest:315760"), guestName: "Kavya (niece)", validFrom: ago(60), validTo: new Date(now.getTime() + 2 * 86_400_000) },
    ])
    .returning({ id: s.guestCodes.id });
  void liveCode;
  const oldPhotos = await db
    .insert(s.photos)
    .values([0, 1, 2].map((i) => ({ mime: "image/png", bytes: placeholderPhoto(), createdAt: ago(60 * 24 * (92 + i * 3)) })))
    .returning({ id: s.photos.id });
  const DELIVERY = ["Zomato delivery", "Swiggy delivery", "Amazon delivery", "Blinkit delivery", "Flipkart delivery", "BigBasket delivery"];
  const SERVICE = ["Urban Company (AC service)", "Plumber (private)", "Internet technician", "Maid (new)"];
  const visitorRows: (typeof s.visitors.$inferInsert)[] = [];
  let v = 1;
  const visitor = (row: Omit<typeof s.visitors.$inferInsert, "clientId" | "gate" | "guardId"> & { gate?: number }) =>
    visitorRows.push({ gate: 1, guardId: GUARDS[0], clientId: `seed-${v++}`, ...row });
  visitor({ flatId: "T07-1203", name: "Imran (Swiggy)", purpose: "DELIVERY", status: "PENDING", arrivedAt: ago(2) });
  visitor({ flatId: "T07-1203", name: "Asha (cook)", purpose: "SERVICE", status: "LEFT", approvalMode: "CODE", guestCodeId: usedCode.id, arrivedAt: ago(300), decidedAt: ago(300), enteredAt: ago(300), leftAt: ago(170) });
  visitor({ flatId: "T12-0408", name: "Ritu Sharma", purpose: "GUEST", status: "INSIDE", approvalMode: "APP", decidedBy: uid.get("9800000002"), arrivedAt: ago(52), decidedAt: ago(51), enteredAt: ago(50), gate: 2, phone: "9812345678" });
  oldPhotos.forEach((p, i) => visitor({ flatId: pick(flats).id!, name: pick(DELIVERY), purpose: "DELIVERY", status: "LEFT", approvalMode: "APP", photoId: p.id, arrivedAt: ago(60 * 24 * (92 + i * 3)), decidedAt: ago(60 * 24 * (92 + i * 3) - 1), enteredAt: ago(60 * 24 * (92 + i * 3) - 2), leftAt: ago(60 * 24 * (92 + i * 3) - 9) }));
  for (let i = 0; i < 320; i++) {
    const minutes = between(30, 60 * 24 * 30);
    const r = rand();
    const purpose = r < 0.42 ? "DELIVERY" : r < 0.85 ? "GUEST" : r < 0.92 ? "CAB" : "SERVICE";
    const denied = chance(0.07);
    const mode = purpose === "GUEST" && chance(0.35) ? "CODE" : chance(0.7) ? "APP" : "INTERCOM";
    visitor({
      flatId: pick(flats).id!,
      name: purpose === "DELIVERY" ? pick(DELIVERY) : purpose === "CAB" ? pick(["Ola cab", "Uber cab", "Rapido"]) : purpose === "SERVICE" ? pick(SERVICE) : person(),
      purpose,
      gate: between(1, 4),
      status: denied ? "DENIED" : "LEFT",
      approvalMode: denied ? "APP" : mode,
      arrivedAt: ago(minutes),
      decidedAt: ago(minutes - 1),
      enteredAt: denied ? null : ago(minutes - 2),
      leftAt: denied ? null : ago(Math.max(1, minutes - between(5, purpose === "GUEST" ? 240 : 20))),
    });
  }
  await chunked(visitorRows, (part) => db.insert(s.visitors).values(part).returning({ id: s.visitors.id }));

  // ---- amenities and bookings (fees go on the flat's ledger) ----
  const amenityIds = await db
    .insert(s.amenities)
    .values([
      { slug: "clubhouse-hall", name: "Clubhouse hall", slotMinutes: 240, openMinute: 600, closeMinute: 1320, feePaise: 200_000, maxPerWeek: 1, advanceDays: 30, rules: "For private functions of up to 80 guests. Music off by 10 pm. Leave the hall as you found it; it is checked before the next booking." },
      { slug: "tennis-court", name: "Tennis court", slotMinutes: 60, openMinute: 360, closeMinute: 1320, feePaise: 10_000, maxPerWeek: 3, advanceDays: 7, rules: "Non-marking shoes only. Floodlights after 6:30 pm are included in the fee." },
      { slug: "badminton-court", name: "Badminton court (indoor)", slotMinutes: 60, openMinute: 360, closeMinute: 1320, feePaise: 5_000, maxPerWeek: 3, advanceDays: 7, rules: "Bring your own shuttles. Children under 12 play with an adult." },
    ])
    .returning({ id: s.amenities.id, slotMinutes: s.amenities.slotMinutes, openMinute: s.amenities.openMinute, closeMinute: s.amenities.closeMinute, feePaise: s.amenities.feePaise });
  const taken = new Set<string>();
  const bookingRows: (typeof s.bookings.$inferInsert)[] = [];
  for (let i = 0; i < 70; i++) {
    const a = i < 4 ? amenityIds[0] : pick(amenityIds.slice(1));
    const date = addDays(today, i < 4 ? between(3, 28) : between(0, 6));
    const slots = (a.closeMinute - a.openMinute) / a.slotMinutes;
    const startMinute = a.openMinute + between(0, slots - 1) * a.slotMinutes;
    const key = `${a.id}|${date}|${startMinute}`;
    const flat = pick(flats).id!;
    if (taken.has(key) || DEMO[flat]) continue;
    taken.add(key);
    bookingRows.push({ amenityId: a.id, flatId: flat, bookedBy: uid.get(primaryOf.get(flat)!.phone)!, date, startMinute, feePaise: a.feePaise, createdAt: ago(between(60, 60 * 24 * 5)) });
  }
  await db.insert(s.bookings).values(bookingRows);
  await chunked(
    bookingRows.map((b) => ({ flatId: b.flatId, kind: "AMENITY" as const, amount: b.feePaise, date: todayIST(b.createdAt as Date), dueDate: nextDueDate(todayIST(b.createdAt as Date)), memo: `Amenity booking on ${fmtDate(b.date)}` })),
    (part) => db.insert(s.ledger).values(part).returning({ id: s.ledger.id }),
  );

  // ---- notices and a couple of notifications ----
  await db.insert(s.notices).values([
    { title: `Maintenance bills for ${fmtMonth(PERIOD)} are out`, body: "Pay by the 15th to avoid interest. Pay in the app by UPI, card or net banking and the receipt is instant. Bank transfers are matched to your flat automatically when you write your flat number (e.g. T07 1203) in the payment note.", createdBy: COMMITTEE, createdAt: at(`${PERIOD}-01`, "09:00") < now ? at(`${PERIOD}-01`, "09:00") : ago(60) },
    { title: "Lift A in T14 under repair", body: "The lift vendor is on site and expects it back in service by evening. Lift B is working. Thank you for reporting it so quickly.", tower: 14, createdBy: HELPDESK, createdAt: ago(140) },
    { title: "Water shutdown in T12 on Thursday, 10 am to 2 pm", body: "Overhead tank cleaning. Please store water the night before.", tower: 12, createdBy: HELPDESK, createdAt: ago(60 * 26) },
    { title: `Annual General Meeting on ${fmtDate(addDays(today, 20))}`, body: "11 am at the clubhouse. Agenda: audited accounts, next year's maintenance rate, CCTV upgrade. Owners or their nominees may attend.", createdBy: COMMITTEE, createdAt: ago(60 * 24 * 3) },
  ]);
  await db.insert(s.notifications).values([
    { userId: neeraj, title: "Imran (Swiggy) is at Gate 1", body: "Approve or deny in the app.", link: "/visitors", createdAt: ago(2) },
    { userId: neeraj, title: `Receipt for ${fmtMonth(PERIOD)} maintenance`, body: "₹7,475 received. Thank you.", link: "/bills", createdAt: at(`${PERIOD}-01`, "09:30") < now ? at(`${PERIOD}-01`, "09:30") : ago(30) },
  ]);
}

const nextDueDate = (date: string) => (Number(date.slice(8)) <= 15 ? `${date.slice(0, 8)}15` : `${shiftPeriod(date.slice(0, 7), 1)}-15`);

// ---------- complaints ----------
type ComplaintSeed = {
  residents: { flatId: string; phone: string; primary: boolean }[];
  uid: Map<string, number>;
  techFor: (c: Category) => { id: number; name: string } | undefined;
  HELPDESK: number;
  MANAGER: number;
};

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

async function seedComplaints({ residents, uid, techFor, HELPDESK, MANAGER }: ComplaintSeed) {
  const primaries = residents.filter((r) => r.primary && !DEMO[r.flatId]);
  type Row = typeof s.complaints.$inferInsert;
  type Ev = { kind: string; note?: string; actorId?: number | null; createdAt: Date };
  const rows: { row: Row; events: Ev[]; parentKey?: string; key?: string }[] = [];

  const add = (opts: {
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
  }) => {
    const tech = opts.triage ? undefined : techFor(opts.category);
    const via = opts.via ?? (chance(0.82) ? "AI" : "RULES");
    const conf = opts.confidence ?? (via === "AI" ? between(72, 98) : null);
    const firstResponseAt = opts.respondAfter == null || opts.status === "OPEN" ? null : later(opts.createdAt, opts.respondAfter);
    const resolvedAt = opts.status === "RESOLVED" || opts.status === "CLOSED" ? later(opts.createdAt, opts.resolveAfter ?? between(120, 60 * 30)) : null;
    const closedAt = opts.status === "CLOSED" && resolvedAt ? later(resolvedAt, opts.closeAfter ?? between(30, 60 * 20)) : null;
    const events: Ev[] = [{ kind: "CREATED", actorId: opts.by, createdAt: opts.createdAt }];
    events.push({ kind: "CLASSIFIED", note: via === "AI" ? `AI: ${opts.category} · ${opts.urgency.toLowerCase()} · ${conf}% sure` : `Rules: ${opts.category} · ${opts.urgency.toLowerCase()}`, createdAt: later(opts.createdAt, 0) });
    if (opts.safety) events.push({ kind: "ESCALATED", note: "Safety words found. Duty manager Anil Jadhav alerted.", createdAt: later(opts.createdAt, 0) });
    if (tech && opts.status !== "OPEN") events.push({ kind: "ASSIGNED", note: `Assigned to ${tech.name}`, createdAt: later(opts.createdAt, 1) });
    if (firstResponseAt) events.push({ kind: "STATUS", note: opts.note ?? "Technician is on the way", actorId: opts.safety ? MANAGER : HELPDESK, createdAt: firstResponseAt });
    if (opts.reopened && resolvedAt) events.push({ kind: "REOPENED", note: "Resident says it is not fixed", actorId: opts.by, createdAt: later(opts.createdAt, between(60, 600)) });
    if (resolvedAt) events.push({ kind: "STATUS", note: "Marked resolved. Waiting for the resident to confirm.", actorId: HELPDESK, createdAt: resolvedAt });
    if (closedAt) events.push({ kind: "RATED", note: `${"★".repeat(opts.rating ?? 5)} Rated ${opts.rating ?? 5}/5`, actorId: opts.by, createdAt: closedAt });
    rows.push({
      key: opts.key,
      parentKey: opts.parentKey,
      events,
      row: {
        flatId: opts.flatId,
        raisedBy: opts.by,
        description: opts.text,
        title: opts.title ?? null,
        category: opts.category,
        urgency: opts.urgency,
        classifiedBy: via,
        aiConfidence: conf,
        needsTriage: opts.triage ?? false,
        safety: opts.safety ?? false,
        status: opts.status,
        assignedTo: opts.status === "OPEN" ? null : (tech?.id ?? null),
        responseDueAt: responseDue(opts.urgency, opts.createdAt),
        firstResponseAt,
        resolvedAt,
        closedAt,
        rating: closedAt ? (opts.rating ?? 5) : null,
        reopenCount: opts.reopened ? 1 : 0,
        createdAt: opts.createdAt,
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
    const status: Row["status"] = days > 7 ? (x < 0.9 ? "CLOSED" : x < 0.95 ? "RESOLVED" : "IN_PROGRESS") : days > 2 ? (x < 0.5 ? "CLOSED" : x < 0.7 ? "RESOLVED" : x < 0.9 ? "IN_PROGRESS" : "ASSIGNED") : x < 0.4 ? "ASSIGNED" : x < 0.8 ? "IN_PROGRESS" : "RESOLVED";
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
    const r = residents.find((x) => x.flatId === flatId && x.primary)!;
    add({
      flatId,
      by: uid.get(r.phone)!,
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
  add({ flatId: "T09-0104", by: uid.get(residents.find((x) => x.flatId === "T09-0104" && x.primary)!.phone)!, text: "Strong smell of gas near the meter room on the ground floor of T09", title: "Gas smell near T09 meter room", category: "Security", urgency: "EMERGENCY", createdAt: ago(40), status: "IN_PROGRESS", via: "AI", confidence: 88, safety: true, respondAfter: 6, note: "Duty manager on site, gas supplier called, area cordoned off." });
  add({ flatId: "T03-0502", by: uid.get(residents.find((x) => x.flatId === "T03-0502" && x.primary)!.phone)!, text: "आमच्या मजल्यावर सकाळपासून पाणी नाही", title: "No water on the floor since morning", category: "Water supply", urgency: "HIGH", createdAt: ago(95), status: "ASSIGNED", via: "AI", confidence: 93, respondAfter: null });
  add({ flatId: "T05-0903", by: uid.get(residents.find((x) => x.flatId === "T05-0903" && x.primary)!.phone)!, text: "Same problem as last week, nobody came. Please check again.", category: "Other", urgency: "MEDIUM", createdAt: ago(25), status: "OPEN", via: "AI", confidence: 34, triage: true, respondAfter: null });

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

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
