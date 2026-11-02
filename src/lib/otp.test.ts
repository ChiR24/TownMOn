import { beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import { testDb } from "@/db/testing";
import { normalizePhone } from "./phone";
import { checkOtp, issueOtp } from "./otp";

let db: DB;
beforeAll(async () => {
  db = await testDb();
});

describe("phone numbers", () => {
  it("accepts the ways people type an Indian mobile", () => {
    for (const p of ["9800000001", "+91 98000 00001", "098000-00001", "91 9800000001"]) expect(normalizePhone(p)).toBe("9800000001");
    expect(normalizePhone("5800000001")).toBeNull();
    expect(normalizePhone("98000")).toBeNull();
  });
});

describe("one-time codes", () => {
  it("signs in once with the right code", async () => {
    const r = await issueOtp(db, "9000000001");
    if (!r.ok) throw new Error("expected a code");
    expect(await checkOtp(db, "9000000001", r.code)).toBe("ok");
    expect(await checkOtp(db, "9000000001", r.code)).toBe("expired"); // single use
  });

  it("locks after five wrong tries, even if the sixth is right", async () => {
    const r = await issueOtp(db, "9000000002");
    if (!r.ok) throw new Error("expected a code");
    const wrong = r.code === "000000" ? "111111" : "000000";
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await checkOtp(db, "9000000002", wrong));
    expect(results).toEqual(["wrong", "wrong", "wrong", "wrong", "locked"]);
    expect(await checkOtp(db, "9000000002", r.code)).toBe("locked");
  });

  it("expires after five minutes", async () => {
    const t = new Date("2026-11-02T10:00:00Z");
    const r = await issueOtp(db, "9000000003", t);
    if (!r.ok) throw new Error("expected a code");
    expect(await checkOtp(db, "9000000003", r.code, new Date("2026-11-02T10:05:01Z"))).toBe("expired");
  });

  it("allows three codes per ten minutes per number", async () => {
    const t = new Date("2026-11-02T11:00:00Z");
    for (let i = 0; i < 3; i++) expect((await issueOtp(db, "9000000004", t)).ok).toBe(true);
    expect(await issueOtp(db, "9000000004", t)).toEqual({ ok: false, error: "tooMany" });
    expect((await issueOtp(db, "9000000004", new Date("2026-11-02T11:10:01Z"))).ok).toBe(true);
  });
});
