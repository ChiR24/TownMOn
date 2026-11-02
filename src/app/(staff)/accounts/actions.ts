"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { AREAS, requireUser } from "@/lib/auth";
import { findFlatCodes } from "@/lib/bank";
import { ignoreTxn, importStatement, postTxnToFlat, reversePayment } from "@/lib/bank-import";
import { generateBills } from "@/lib/billing-run";
import { todayIST } from "@/lib/dates";

export type FormState = { error?: string; ok?: string; value?: string };
const accounts = () => requireUser(AREAS.accounts);

export async function uploadStatement(_: FormState, form: FormData): Promise<FormState> {
  const user = await accounts();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the bank statement CSV first." };
  if (file.size > 3 * 1024 * 1024) return { error: "That file is over 3 MB. Export one month at a time." };
  if (!/\.csv$/i.test(file.name)) return { error: "Export the statement from net banking as CSV (not PDF or Excel)." };
  const result = await importStatement(db, { fileName: file.name.slice(0, 120), text: await file.text(), uploadedBy: user.id });
  if ("error" in result) return { error: result.error };
  revalidatePath("/accounts", "layout");
  redirect(`/accounts/imports/${result.id}`);
}

/** Accepts "T07-1203", "t7 1203", "T071203"... */
const asFlatId = (raw: string) => findFlatCodes(raw)[0] ?? raw.trim().toUpperCase();

export async function postToFlat(txnId: number, flatId: string) {
  const user = await accounts();
  await postTxnToFlat(db, txnId, flatId, user.id);
  revalidatePath("/accounts", "layout");
}

export async function postToTypedFlat(txnId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await accounts();
  const raw = String(form.get("flatId") ?? "");
  const r = await postTxnToFlat(db, txnId, asFlatId(raw), user.id);
  if ("error" in r) return { error: r.error, value: raw };
  revalidatePath("/accounts", "layout");
  return { ok: "Posted" };
}

const Reason = z.enum(["Bank interest", "Refund or reversal by the bank", "Vendor or other income", "Duplicate of an entry already posted"]);

export async function ignoreEntry(txnId: number, form: FormData) {
  const user = await accounts();
  await ignoreTxn(db, txnId, user.id, Reason.catch("Vendor or other income").parse(form.get("reason")));
  revalidatePath("/accounts", "layout");
}

export async function reverse(paymentId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await accounts();
  const value = String(form.get("reason") ?? "");
  const reason = value.trim();
  if (reason.length < 5) return { error: "Say why, in a few words. It goes on the flat's ledger.", value };
  const r = await reversePayment(db, paymentId, user.id, reason.slice(0, 200));
  if ("error" in r) return { error: r.error, value };
  revalidatePath("/accounts", "layout");
  return { ok: "Reversed. The bank entry is back in the review queue." };
}

export async function findFlat(form: FormData) {
  await accounts();
  redirect(`/accounts/flats/${encodeURIComponent(asFlatId(String(form.get("q") ?? "")))}`);
}

export async function runBills() {
  const user = await accounts();
  await generateBills(db, todayIST().slice(0, 7), user.id);
  revalidatePath("/accounts", "layout");
}
