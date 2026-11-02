"use client";

import { Share2 } from "lucide-react";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, inputCls } from "@/components/ui";
import { makeCode, type CodeState } from "./code-actions";

type S = Record<"guestName" | "validFor" | "create" | "share" | "codeFor" | "h4" | "d1" | "d3" | "shareText" | "validTill" | "nameError", string>;

export function CodeForm({ s, place, lang }: { s: S; place: string; lang: string }) {
  const [state, action] = useActionState(makeCode, {} as CodeState);
  const till = state.validTo ? new Date(state.validTo).toLocaleString(`${lang}-IN-u-nu-latn`, { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
  const text = state.code ? s.shareText.replace("{place}", place).replace("{code}", state.code).replace("{till}", till) : "";

  return (
    <div className="space-y-5">
      {state.code && (
        // A ticket the resident can forward: the code big enough to read out to the guest over the phone.
        <div className="overflow-hidden rounded-[28px] bg-cta text-cta-ink motion-safe:animate-sheet" role="status">
          <div className="px-5 pb-4 pt-5 text-center">
            <p className="text-sm opacity-70">{s.codeFor.replace("{name}", state.guestName ?? "")}</p>
            <p className="mt-2 font-mono text-[40px] font-semibold tracking-[0.22em]">{state.code}</p>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-dashed border-current/25 px-5 py-3.5">
            <p className="text-xs opacity-70">{s.validTill.replace("{time}", till)}</p>
            <Button
              variant="accent"
              size="sm"
              onClick={async () => {
                if (navigator.share) await navigator.share({ text }).catch(() => {});
                else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
              }}
            >
              <Share2 className="size-4" aria-hidden /> {s.share}
            </Button>
          </div>
        </div>
      )}
      <form action={action} className="space-y-4">
        <Field label={s.guestName} htmlFor="guestName" error={state.error ? s.nameError : undefined}>
          <input id="guestName" name="guestName" required minLength={2} maxLength={60} autoComplete="off" className={inputCls} />
        </Field>
        <fieldset>
          <legend className="mb-2 px-1 text-sm font-medium text-ink-2">{s.validFor}</legend>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["4", s.h4],
              ["24", s.d1],
              ["72", s.d3],
            ].map(([v, label], i) => (
              <label key={v} className="press flex h-12 cursor-pointer items-center justify-center rounded-full bg-muted text-sm font-semibold text-ink-2 has-[:checked]:bg-cta has-[:checked]:text-cta-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink">
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
