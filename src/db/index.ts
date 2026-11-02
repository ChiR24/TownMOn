import { mkdirSync } from "node:fs";
import { drizzle as pgDrizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as liteDrizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Anything that can run queries: the db itself or an open transaction. */
export type Q = DB | Tx;

// DATABASE_URL set -> real Postgres. Unset -> embedded Postgres (PGlite) in .data/, so the app runs with no setup.
function create(): DB {
  const url = process.env.DATABASE_URL;
  if (url) return pgDrizzle(url, { schema, casing: "snake_case" });
  // ponytail: PGlite is single-connection; fine for local runs and demos, use DATABASE_URL for production.
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  mkdirSync(dir, { recursive: true });
  return liteDrizzle(dir, { schema, casing: "snake_case" }) as unknown as DB;
}

const g = globalThis as unknown as { __db?: DB };
export const db: DB = (g.__db ??= create());
