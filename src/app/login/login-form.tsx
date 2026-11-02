"use client";

import { ChevronRight, MessageSquareText } from "lucide-react";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, Field, inputCls } from "@/components/ui";
import { maskPhone } from "@/lib/phone";
import { login, type LoginState } from "./actions";

type Strings = Record<"phone" | "send" | "sentTo" | "code" | "verify" | "change" | "resend" | "demo" | "demoHint" | "demoSms", string> & Record<`err.${string}`, string>;
type DemoAccount = { phone: string; name: string; role: string; note: string };

export function LoginForm({ s, demo, initialError }: { s: Strings; demo: readonly DemoAccount[]; initialError?: string }) {
  const [state, action] = useActionState(login, { step: "phone" } as LoginState);
  const [code, setCode] = useState("");
  const error = state.error ? s[`err.${state.error}`] : initialError;

  if (state.step === "code" && state.phone) {
    return (
      <div className="space-y-4 motion-safe:animate-enter">
        {state.demoCode && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-3.5 py-3 text-sm text-accent-ink">
            <span className="flex items-center gap-2">
              <MessageSquareText className="size-4 shrink-0" aria-hidden />
              {s.demoSms.replace("{code}", state.demoCode)}
            </span>
            <button type="button" onClick={() => setCode(state.demoCode!)} className="press rounded-xl bg-surface px-3 py-1.5 font-bold text-accent-ink shadow-sm">
              Use
            </button>
          </div>
        )}
        <form action={action} className="space-y-4">
          <input type="hidden" name="phone" value={state.phone} />
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
              className={`${inputCls} h-16 text-center text-3xl font-bold tracking-[0.45em] tabular-nums`}
              autoFocus
            />
          </Field>
          <SubmitButton name="intent" value="verify" size="lg" className="w-full">
            {s.verify}
          </SubmitButton>
          <div className="flex items-center justify-between text-sm">
            <button name="intent" value="change" formNoValidate className="press rounded-xl px-2 py-2 font-medium text-ink-2 hover:text-ink">
              {s.change}
            </button>
            <button name="intent" value="send" formNoValidate className="press rounded-xl px-2 py-2 font-semibold text-accent-ink">
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
          <div className="flex">
            <span className="inline-flex items-center rounded-l-2xl bg-muted px-4 text-base font-semibold text-ink-2 ring-1 ring-inset ring-line">+91</span>
            <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required placeholder="98XXXXXXXX" className={`${inputCls} rounded-l-none text-lg tracking-wide`} autoFocus />
          </div>
        </Field>
        <SubmitButton name="intent" value="send" size="lg" className="w-full">
          {s.send}
        </SubmitButton>
      </form>

      {demo.length > 0 && (
        <section aria-labelledby="demo-heading" className="mt-6 border-t border-line pt-5">
          <h2 id="demo-heading" className="text-sm font-bold text-ink">
            {s.demo}
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">{s.demoHint}</p>
          <ul className="-mx-2 mt-2">
            {demo.map((a) => (
              <li key={a.phone}>
                <form action={action}>
                  <input type="hidden" name="phone" value={a.phone} />
                  <button name="intent" value="send" className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-muted">
                    <Avatar name={a.name} className="size-10 text-sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-ink">{a.name}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {a.role} · {a.note}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
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
