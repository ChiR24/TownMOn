"use client";

import { Share2 } from "lucide-react";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, inputCls } from "@/components/ui";
import { makeCode, type CodeState } from "./code-actions";

type S = Record<"guestName" | "validFor" | "create" | "share" | "codeFor" | "h4" | "d1" | "d3" | "shareText" | "validTill", string>;

export function CodeForm({ s, place }: { s: S; place: string }) {
  const [state, action] = useActionState(makeCode, {} as CodeState);
  const till = state.validTo ? new Date(state.validTo).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
  const text = state.code ? s.shareText.replace("{place}", place).replace("{code}", state.code).replace("{till}", till) : "";

  return (
    <div className="space-y-4">
      {state.code && (
        <div className="rounded-2xl bg-teal-50 p-4 text-center ring-1 ring-teal-200">
          <p className="text-sm text-teal-900">{s.codeFor.replace("{name}", state.guestName ?? "")}</p>
          <p className="my-2 font-mono text-4xl font-semibold tracking-[0.25em] text-zinc-950">{state.code}</p>
          <p className="text-xs text-teal-900">{s.validTill.replace("{time}", till)}</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={async () => {
              if (navigator.share) await navigator.share({ text }).catch(() => {});
              else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
            }}
          >
            <Share2 className="size-4" aria-hidden /> {s.share}
          </Button>
        </div>
      )}
      <form action={action} className="space-y-3">
        <Field label={s.guestName} htmlFor="guestName" error={state.error ? " " : undefined}>
          <input id="guestName" name="guestName" required minLength={2} maxLength={60} className={inputCls} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-zinc-800">{s.validFor}</legend>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["4", s.h4],
              ["24", s.d1],
              ["72", s.d3],
            ].map(([v, label], i) => (
              <label key={v} className="flex h-11 cursor-pointer items-center justify-center rounded-xl bg-white text-sm font-medium ring-1 ring-zinc-300 has-[:checked]:bg-teal-700 has-[:checked]:text-white has-[:checked]:ring-teal-700">
                <input type="radio" name="hours" value={v} defaultChecked={i === 1} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <SubmitButton className="w-full">{s.create}</SubmitButton>
      </form>
    </div>
  );
}
