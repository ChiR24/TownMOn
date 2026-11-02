"use client";

import { Star } from "lucide-react";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { cx, inputCls } from "@/components/ui";
import { closeWithRating, type State } from "../actions";

export function RateForm({ id, s }: { id: number; s: Record<"rate" | "comment" | "close" | "err", string> }) {
  const [state, action] = useActionState(closeWithRating.bind(null, id), {} as State);
  const [stars, setStars] = useState(0);
  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-[15px] font-medium text-ink-2">{s.rate}</legend>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="press cursor-pointer rounded-full p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink">
              <input type="radio" name="rating" value={n} className="sr-only" onChange={() => setStars(n)} required />
              <Star className={`size-10 ${n <= stars ? "fill-amber-400 text-amber-400" : "text-ink/15"}`} aria-label={`${n} of 5`} />
            </label>
          ))}
        </div>
        {state.error && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {s.err}
          </p>
        )}
      </fieldset>
      <textarea name="comment" rows={2} maxLength={500} placeholder={s.comment} className={cx(inputCls, "!rounded-[24px]")} />
      <SubmitButton className="w-full" disabled={!stars}>
        {s.close}
      </SubmitButton>
    </form>
  );
}
