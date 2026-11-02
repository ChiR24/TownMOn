"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { currentUser, endSession, residentFlats } from "@/lib/auth";
import { isLang } from "@/lib/i18n";

const YEAR = 60 * 60 * 24 * 365;

export async function setLang(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set("lang", lang, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const u = await currentUser();
  if (u) await db.update(users).set({ lang }).where(eq(users.id, u.id));
  revalidatePath("/", "layout");
}

export async function switchFlat(flatId: string) {
  const u = await currentUser();
  if (!u) redirect("/login");
  const { all } = await residentFlats(u.id);
  if (all.some((f) => f.flatId === flatId)) (await cookies()).set("flat", flatId, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

/** Clears the unread dot on the bell once the resident has seen their messages. */
export async function markMessagesRead() {
  const u = await currentUser();
  if (!u) return;
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, u.id), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
}

export async function signOut() {
  await endSession();
  redirect("/login");
}
