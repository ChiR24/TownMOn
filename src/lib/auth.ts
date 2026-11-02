import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { flatMembers, flats, sessions, users } from "@/db/schema";
import { randomToken, sha256 } from "./crypto";

const SESSION_COOKIE = "tw_session";
const SESSION_DAYS = 30;

export type Role = (typeof users.role.enumValues)[number];

/** Which roles may open each staff area. The duty manager sees all of them. */
export const AREAS = {
  desk: ["HELPDESK", "MANAGER"],
  accounts: ["ACCOUNTS", "MANAGER"],
  committee: ["COMMITTEE", "MANAGER"],
  gate: ["GUARD", "MANAGER"],
} as const satisfies Record<string, readonly Role[]>;

export function homeFor(role: Role) {
  if (role === "RESIDENT") return "/";
  if (role === "GUARD") return "/gate";
  if (role === "ACCOUNTS") return "/accounts";
  if (role === "COMMITTEE") return "/committee";
  if (role === "TECHNICIAN") return "/login?e=noaccess"; // technicians don't use the app in this version; the help desk updates complaints for them (TDD, A10)
  return "/desk";
}

/** The signed-in user for this request (one indexed lookup, memoised per request), or null. */
export const currentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [u] = await db
    .select({ id: users.id, name: users.name, phone: users.phone, role: users.role, lang: users.lang, privacyAcceptedAt: users.privacyAcceptedAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date()), eq(users.active, true)));
  return u ?? null;
});
type User = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

/** Every page and server action starts here. Wrong role goes home; nobody gets data they shouldn't. */
export async function requireUser(roles?: readonly Role[]): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (!u.privacyAcceptedAt) redirect("/welcome");
  if (roles && !roles.includes(u.role)) redirect(homeFor(u.role));
  return u;
}

export async function startSession(userId: number) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt: expires });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

/** A resident's flats and the one they are looking at (cookie, but only ever one of their own). */
export const residentFlats = cache(async (userId: number) => {
  const mine = await db
    .select({ flatId: flatMembers.flatId, relation: flatMembers.relation, isPrimary: flatMembers.isPrimary, areaSqft: flats.areaSqft, tower: flats.tower })
    .from(flatMembers)
    .innerJoin(flats, eq(flats.id, flatMembers.flatId))
    .where(and(eq(flatMembers.userId, userId), eq(flatMembers.active, true)))
    .orderBy(flatMembers.flatId);
  const chosen = (await cookies()).get("flat")?.value;
  const current = mine.find((m) => m.flatId === chosen) ?? mine.find((m) => m.relation !== "OWNER" || m.isPrimary) ?? mine[0];
  return { current, all: mine };
});

/** For resident pages: the user plus the flat in view. Residents with no active flat can't use the app. */
export async function requireResident() {
  const user = await requireUser(["RESIDENT"]);
  const { current, all } = await residentFlats(user.id);
  if (!current) redirect("/login?e=noflat");
  return { user, flat: current, flats: all };
}
