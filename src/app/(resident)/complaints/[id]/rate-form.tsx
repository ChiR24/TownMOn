"use client";

import { Star } from "lucide-react";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { inputCls } from "@/components/ui";
import { closeWithRating, type State } from "../actions";

export function RateForm({ id, s }: { id: number; s: Record<"rate" | "comment" | "close", string> }) {
  const [state, action] = useActionState(closeWithRating.bind(null, id), {} as State);
  const [stars, setStars] = useState(0);
  return (
    <form action={action} className="space-y-3">
      <fieldset>
        <legend className="mb-2 text-[15px] font-medium text-ink">{s.rate}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer p-1">
              <input type="radio" name="rating" value={n} className="sr-only" onChange={() => setStars(n)} required />
              <Star className={`size-9 ${n <= stars ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-600"}`} aria-label={`${n} of 5`} />
            </label>
          ))}
        </div>
        {state.error && <p className="text-sm text-red-700 dark:text-red-300">Pick 1 to 5 stars.</p>}
      </fieldset>
      <textarea name="comment" rows={2} maxLength={500} placeholder={s.comment} className={inputCls} />
      <SubmitButton className="w-full" disabled={!stars}>
        {s.close}
      </SubmitButton>
    </form>
  );
}
