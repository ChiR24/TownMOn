"use client";

import { useActionState, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputCls } from "@/components/ui";
import { postNotice } from "../actions";

export function NoticeForm() {
  const form = useRef<HTMLFormElement>(null);
  type S = { error?: string; ok?: boolean };
  const [state, action] = useActionState<S, FormData>(async (prev, data) => {
    const r: S = await postNotice(prev, data);
    if (r.ok) form.current?.reset();
    return r;
  }, {});
  return (
    <form ref={form} action={action} className="space-y-3">
      <Field label="Title" htmlFor="title">
        <input id="title" name="title" required minLength={5} maxLength={120} className={inputCls} placeholder="Water shutdown in T12 on Thursday" />
      </Field>
      <Field label="Details" htmlFor="body">
        <textarea id="body" name="body" required minLength={5} maxLength={1500} rows={4} className={inputCls} />
      </Field>
      <Field label="Who sees it" htmlFor="tower">
        <select id="tower" name="tower" className={`${inputCls} py-2.5`} defaultValue="all">
          <option value="all">Everyone</option>
          {Array.from({ length: 28 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Tower {String(i + 1).padStart(2, "0")} only
            </option>
          ))}
        </select>
      </Field>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-700">Posted. Residents see it on their home screen.</p>}
      <SubmitButton className="w-full">Post notice</SubmitButton>
    </form>
  );
}
