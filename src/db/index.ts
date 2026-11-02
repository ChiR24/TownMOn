import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  // PGlite is single-connection: right for local runs and tests. The deployed app uses DATABASE_URL.
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  if (!dir.startsWith("memory://")) {
    mkdirSync(dir, { recursive: true });
    lockDir(dir);
  }
  return liteDrizzle(dir, { schema, casing: "snake_case" }) as unknown as DB;
}

/** PGlite on disk is one process only; two processes on one folder corrupt it. Refuse with a clear message instead. */
function lockDir(dir: string) {
  const lock = `${dir}.lock`;
  try {
    const pid = Number(readFileSync(lock, "utf8"));
    if (pid && pid !== process.pid) {
      process.kill(pid, 0); // throws if that process is gone
      throw new Error(`The local database is in use by another process (pid ${pid}). Stop "npm run dev" first, then try again.`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("The local database")) throw e;
  }
  writeFileSync(lock, String(process.pid));
  process.once("exit", () => rmSync(lock, { force: true }));
}

// Connect on first use, not on import: build workers and tests import this module without touching the database.
const g = globalThis as unknown as { __db?: DB };
const instance = () => (g.__db ??= create());
export const db = new Proxy({} as DB, {
  get(_, prop) {
    const real = instance();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
