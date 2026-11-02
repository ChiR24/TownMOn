"use client";

import { MessageSquareText } from "lucide-react";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputCls } from "@/components/ui";
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
      <div className="space-y-4">
        {state.demoCode && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-teal-50 px-3.5 py-3 text-sm text-teal-900">
            <span className="flex items-center gap-2">
              <MessageSquareText className="size-4 shrink-0" aria-hidden />
              {s.demoSms.replace("{code}", state.demoCode)}
            </span>
            <button type="button" onClick={() => setCode(state.demoCode!)} className="rounded-lg bg-white px-2.5 py-1 font-medium text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100">
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
              className={`${inputCls} text-center text-2xl tracking-[0.5em] tabular-nums`}
              autoFocus
            />
          </Field>
          <SubmitButton name="intent" value="verify" size="lg" className="w-full">
            {s.verify}
          </SubmitButton>
          <div className="flex items-center justify-between text-sm">
            <button name="intent" value="change" formNoValidate className="rounded-lg px-1 py-2 text-zinc-600 hover:text-zinc-900">
              {s.change}
            </button>
            <button name="intent" value="send" formNoValidate className="rounded-lg px-1 py-2 font-medium text-teal-800 hover:text-teal-900">
              {s.resend}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <form action={action} className="space-y-4">
        <Field label={s.phone} error={error} htmlFor="phone">
          <div className="flex">
            <span className="inline-flex items-center rounded-l-xl bg-zinc-100 px-3 text-base text-zinc-600 ring-1 ring-inset ring-zinc-300">+91</span>
            <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required placeholder="98XXXXXXXX" className={`${inputCls} rounded-l-none`} autoFocus />
          </div>
        </Field>
        <SubmitButton name="intent" value="send" size="lg" className="w-full">
          {s.send}
        </SubmitButton>
      </form>

      {demo.length > 0 && (
        <section aria-labelledby="demo-heading" className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200/80">
          <h2 id="demo-heading" className="text-sm font-semibold text-zinc-900">
            {s.demo}
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">{s.demoHint}</p>
          <ul className="mt-3 divide-y divide-zinc-100">
            {demo.map((a) => (
              <li key={a.phone}>
                <form action={action}>
                  <input type="hidden" name="phone" value={a.phone} />
                  <button name="intent" value="send" className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-zinc-50">
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium text-zinc-900">{a.name}</span>
                      <span className="block truncate text-xs text-zinc-500">
                        {a.role} · {a.note}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-400">{a.phone}</span>
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
