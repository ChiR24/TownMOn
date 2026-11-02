"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { inputCls } from "@/components/ui";
import { addMember, type MemberState } from "./actions";

export function MemberForm({ s }: { s: Record<"name" | "phone" | "add" | "hint" | "taken" | "badPhone" | "badName" | "added", string> }) {
  const [state, action] = useActionState(addMember, {} as MemberState);
  const error = state.error === "taken" ? s.taken : state.error === "phone" ? s.badPhone : state.error === "name" ? s.badName : null;
  return (
    <form action={action} className="space-y-3 border-t border-line pt-4">
      <p className="text-sm leading-relaxed text-ink-2">{s.hint}</p>
      {/* Keyed on the last answer, so after a mistake the fields come back with what was typed. */}
      <div key={JSON.stringify(state.values ?? {})} className="grid gap-2.5 sm:grid-cols-2">
        <input name="name" required minLength={2} maxLength={60} defaultValue={state.values?.name} placeholder={s.name} aria-label={s.name} autoComplete="off" className={inputCls} />
        <input name="phone" type="tel" required inputMode="numeric" defaultValue={state.values?.phone} placeholder={s.phone} aria-label={s.phone} autoComplete="off" className={inputCls} />
      </div>
      {error && (
        <p className="px-1 text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      )}
      {state.ok && (
        <p className="px-1 text-sm text-emerald-700 dark:text-emerald-300" role="status">
          {s.added}
        </p>
      )}
      <SubmitButton variant="secondary" className="w-full">
        {s.add}
      </SubmitButton>
    </form>
  );
}
