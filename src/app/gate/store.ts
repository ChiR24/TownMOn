// The gate tablet's shapes and its offline memory: a tiny IndexedDB key-value store that survives reloads and network drops.
import type { GateKey } from "./strings";

export type Purpose = "GUEST" | "DELIVERY" | "CAB" | "SERVICE" | "OTHER";
export type Outcome = "PENDING" | "INTERCOM_APPROVED" | "INTERCOM_DENIED" | "CODE";
export type Entry = { id: number; clientId: string; flatId: string; name: string; purpose: Purpose; status: string; approvalMode: string | null; photoId: number | null; arrivedAt: string; gate?: number };
export type Code = { id: number; flatId: string; guestName: string; salt: string; hash: string; validFrom: string; validTo: string };
export type Queued = { clientId: string; flatId: string; name: string; phone: string; purpose: Purpose; gate: number; arrivedAt: string; outcome: Outcome; guestCodeId?: number; photo?: Blob };
export type CodeResult = { ok: true; guestName: string; flatId: string } | { error: "invalid" | "used" | "expired" };
export type GateT = (k: GateKey, v?: Record<string, string | number>) => string;

const open = () =>
  new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open("gate", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((res) => {
    const q = db.transaction("kv").objectStore("kv").get(key);
    q.onsuccess = () => res(q.result as T);
    q.onerror = () => res(undefined);
  });
}

export async function kvSet(key: string, value: unknown) {
  const db = await open();
  return new Promise<void>((res) => {
    const t = db.transaction("kv", "readwrite");
    t.objectStore("kv").put(value, key);
    t.oncomplete = () => res();
    t.onerror = () => res();
  });
}

/** Same hash the server stores as `offlineHash`, so a guest code can be checked with the network down. */
export const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
