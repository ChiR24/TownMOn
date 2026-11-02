/*
 * Seeds a realistic township: 28 towers, 2,400 flats, four months of bills and payments run through the
 * real billing engine, a bank import history, complaints, visitors, amenity bookings and notices.
 * Deterministic (fixed random seed) and relative to today, so the demo always looks current.
 * The steps live in ./seed/ and run in this order (the order matters: they share one random sequence).
 *
 *   npm run db:seed             reset and seed
 *   tsx src/db/seed.ts --if-empty     seed only if there is no data (runs before `npm run dev`)
 *   tsx src/db/seed.ts --migrate-only
 */
import { count, sql } from "drizzle-orm";
import { migrate as pgMigrate } from "drizzle-orm/node-postgres/migrator";
import { migrate as liteMigrate } from "drizzle-orm/pglite/migrator";
import { db } from "./index";
import * as s from "./schema";
import { seedComplaints } from "./seed/complaints";
import { seedLife } from "./seed/life";
import { seedMoney } from "./seed/money";
import { seedPeople } from "./seed/people";

async function migrate() {
  const cfg = { migrationsFolder: "drizzle" };
  if (process.env.DATABASE_URL) await pgMigrate(db, cfg);
  else await liteMigrate(db as never, cfg);
}

async function reset() {
  const tables = [
    "audit_log", "notifications", "sessions", "otp_challenges", "notices", "bookings", "amenities", "visitors", "guest_codes",
    "complaint_events", "complaints", "photos", "payer_accounts", "bank_txns", "bank_imports", "gateway_orders", "ledger",
    "payments", "bills", "flat_members", "flats", "users",
  ];
  await db.execute(sql.raw(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`));
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
  const township = await seedPeople();
  await seedMoney(township);
  await seedComplaints(township);
  await seedLife(township);
  console.log(`Seeded in ${((Date.now() - started) / 1000).toFixed(1)}s. Demo logins are listed on the sign-in page.`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
