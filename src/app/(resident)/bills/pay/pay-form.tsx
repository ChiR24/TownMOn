"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { cx, inputCls } from "@/components/ui";
import { startPayment } from "./actions";

type S = Record<"full" | "other" | "amount" | "continue" | "test" | "error", string>;

export function PayForm({ balance, balanceLabel, s }: { balance: number; balanceLabel: string; s: S }) {
  const [state, action] = useActionState(startPayment, {});
  const [choice, setChoice] = useState<"full" | "other">(balance > 0 ? "full" : "other");
  const option = (value: "full" | "other", title: string, detail?: string) => (
    <label className={cx("flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1", choice === value ? "ring-2 ring-teal-700" : "ring-zinc-200")}>
      <span className="flex items-center gap-3">
        <input type="radio" name="choice" value={value} checked={choice === value} onChange={() => setChoice(value)} className="size-5 accent-teal-700" />
        <span className="text-[15px] font-medium text-zinc-900">{title}</span>
      </span>
      {detail && <span className="text-[15px] font-semibold tabular-nums">{detail}</span>}
    </label>
  );
  return (
    <form action={action} className="space-y-3">
      {balance > 0 && option("full", s.full, balanceLabel)}
      {option("other", s.other)}
      {choice === "other" && (
        <div>
          <label htmlFor="amount" className="sr-only">
            {s.amount}
          </label>
          <input id="amount" name="amount" type="number" inputMode="decimal" min={1} max={500000} step="0.01" required placeholder={s.amount} className={inputCls} autoFocus />
        </div>
      )}
      {state.error && (
        <p className="text-sm text-red-700" role="alert">
          {s.error}
        </p>
      )}
      <SubmitButton size="lg" className="mt-2 w-full">
        {s.continue}
      </SubmitButton>
      <p className="text-center text-xs text-zinc-500">{s.test}</p>
    </form>
  );
}
