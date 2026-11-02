"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { cx, inputCls } from "@/components/ui";
import { startPayment, type PayState } from "./actions";

type S = Record<"full" | "other" | "amount" | "continue" | "test" | "error", string>;

export function PayForm({ balance, balanceLabel, s }: { balance: number; balanceLabel: string; s: S }) {
  const [state, action] = useActionState(startPayment, {} as PayState);
  const [choice, setChoice] = useState<"full" | "other">(balance > 0 ? "full" : "other");
  const option = (value: "full" | "other", title: string, detail?: string) => (
    <label className={cx("press flex cursor-pointer items-center justify-between gap-3 rounded-[24px] bg-surface px-5 py-4", choice === value ? "ring-2 ring-cta" : "ring-1 ring-line")}>
      <span className="flex items-center gap-3">
        <input type="radio" name="choice" value={value} checked={choice === value} onChange={() => setChoice(value)} className="size-5 accent-ink" />
        <span className="text-[15px] font-semibold text-ink">{title}</span>
      </span>
      {detail && <span className="text-lg font-semibold tabular-nums">{detail}</span>}
    </label>
  );
  return (
    <form action={action} className="space-y-3">
      {balance > 0 && option("full", s.full, balanceLabel)}
      {option("other", s.other)}
      {choice === "other" && (
        <div className="relative">
          <label htmlFor="amount" className="sr-only">
            {s.amount}
          </label>
          <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-lg font-semibold text-ink-3" aria-hidden>
            ₹
          </span>
          <input key={state.typed ?? ""} id="amount" name="amount" type="number" inputMode="decimal" min={1} max={500000} step="0.01" required defaultValue={state.typed} placeholder={s.amount} className={cx(inputCls, "!rounded-[24px] py-4 pl-10 text-lg font-semibold")} autoFocus />
        </div>
      )}
      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {s.error}
        </p>
      )}
      <SubmitButton size="lg" className="mt-2 w-full">
        {s.continue}
      </SubmitButton>
      <p className="text-center text-xs text-ink-3">{s.test}</p>
    </form>
  );
}
