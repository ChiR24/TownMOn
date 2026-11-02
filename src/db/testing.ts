import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { DB } from "./index";
import * as schema from "./schema";

/** A fresh in-memory Postgres with the real migrations applied. One per test file. */
export async function testDb(): Promise<DB> {
  const db = drizzle(new PGlite(), { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as DB;
}
