"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { inputCls } from "@/components/ui";
import { addMember, type MemberState } from "./actions";

export function MemberForm({ s }: { s: Record<"name" | "phone" | "add" | "hint" | "taken" | "badPhone" | "badName", string> }) {
  const [state, action] = useActionState(addMember, {} as MemberState);
  const error = state.error === "taken" ? s.taken : state.error === "phone" ? s.badPhone : state.error === "name" ? s.badName : null;
  return (
    <form action={action} className="space-y-2">
      <p className="text-sm text-ink-2">{s.hint}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="name" required minLength={2} maxLength={60} placeholder={s.name} aria-label={s.name} className={inputCls} />
        <input name="phone" required inputMode="numeric" placeholder={s.phone} aria-label={s.phone} className={inputCls} />
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {state.ok && <p className="text-sm text-emerald-700 dark:text-emerald-300">✓</p>}
      <SubmitButton variant="secondary" className="w-full">
        {s.add}
      </SubmitButton>
    </form>
  );
}
