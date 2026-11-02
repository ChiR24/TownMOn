"use client";

import { ArrowRight, ArrowUpRight, MessageSquareText } from "lucide-react";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, cx, Field, inputCls } from "@/components/ui";
import { maskPhone } from "@/lib/phone";
import { login, type LoginState } from "./actions";

type Strings = Record<"phone" | "send" | "sentTo" | "code" | "verify" | "change" | "resend" | "demo" | "demoHint" | "demoSms" | "use", string> & Record<`err.${string}`, string>;
type DemoAccount = { phone: string; name: string; role: string; note: string };

export function LoginForm({ s, demo, initialError }: { s: Strings; demo: readonly DemoAccount[]; initialError?: string }) {
  const [state, action] = useActionState(login, { step: "phone" } as LoginState);
  const [code, setCode] = useState("");
  const error = state.error ? s[`err.${state.error}`] : initialError;

  if (state.step === "code" && state.phone) {
    return (
      <div className="space-y-4 motion-safe:animate-enter">
        {state.demoCode && (
          <div className="flex items-center justify-between gap-3 rounded-[20px] bg-accent-soft py-2 pl-4 pr-2 text-sm text-accent-ink">
            <span className="flex items-center gap-2">
              <MessageSquareText className="size-4 shrink-0" aria-hidden />
              {s.demoSms.replace("{code}", state.demoCode)}
            </span>
            <button type="button" onClick={() => setCode(state.demoCode!)} className="press rounded-full bg-cta px-4 py-2 font-semibold text-cta-ink">
              {s.use}
            </button>
          </div>
        )}
        <form action={action} className="space-y-4">
          <input type="hidden" name="phone" value={state.phone} />
          {state.demoCode && <input type="hidden" name="demo" value={state.demoCode} />}
          <Field label={s.sentTo.replace("{phone}", maskPhone(state.phone))} error={error} htmlFor="code">
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              className={cx(inputCls, "h-16 !rounded-[24px] text-center text-3xl font-semibold tracking-[0.45em] tabular-nums")}
              autoFocus
            />
          </Field>
          <SubmitButton name="intent" value="verify" size="lg" className="w-full">
            {s.verify} <ArrowRight className="size-5" aria-hidden />
          </SubmitButton>
          <div className="flex items-center justify-between text-sm">
            <button name="intent" value="change" formNoValidate className="press rounded-full px-3 py-2 font-medium text-ink-2 hover:bg-muted hover:text-ink">
              {s.change}
            </button>
            <button name="intent" value="send" formNoValidate className="press rounded-full px-3 py-2 font-semibold text-accent-ink hover:bg-muted">
              {s.resend}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <form action={action} className="space-y-4">
        <Field label={s.phone} error={error} htmlFor="phone">
          <div className="relative">
            <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-muted px-3 py-2 text-sm font-semibold text-ink-2" aria-hidden>
              +91
            </span>
            <input key={state.typed ?? ""} id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required defaultValue={state.typed} placeholder="98XXXXXXXX" className={cx(inputCls, "h-14 !rounded-full pl-[4.75rem] text-lg tracking-wide")} autoFocus />
          </div>
        </Field>
        <SubmitButton name="intent" value="send" size="lg" className="w-full">
          {s.send} <ArrowRight className="size-5" aria-hidden />
        </SubmitButton>
      </form>

      {demo.length > 0 && (
        <section aria-labelledby="demo-heading" className="mt-6 border-t border-line pt-5">
          <h2 id="demo-heading" className="text-sm font-semibold text-ink">
            {s.demo}
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">{s.demoHint}</p>
          <ul className="-mx-2 mt-3 space-y-1">
            {demo.map((a) => (
              <li key={a.phone}>
                <form action={action}>
                  <input type="hidden" name="phone" value={a.phone} />
                  <button name="intent" value="send" aria-label={`${a.name}, ${a.role}, ${a.note}`} className="press flex w-full items-center gap-3 rounded-[20px] px-2 py-2 text-left hover:bg-muted">
                    <Avatar name={a.name} className="size-11 text-sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{a.name}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {a.role} · {a.note}
                      </span>
                    </span>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-ink-2">
                      <ArrowUpRight className="size-4" aria-hidden />
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
