"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputCls, Select } from "@/components/ui";
import { postNotice, type NoticeState } from "../actions";

export function NoticeForm() {
  const [state, action] = useActionState(postNotice, {} as NoticeState);
  // After a mistake the fields come back as typed (React empties a form after its action); after posting, they clear.
  const v = state.values;
  return (
    <form action={action} className="space-y-3">
      <div key={JSON.stringify(v ?? {})} className="space-y-3">
        <Field label="Title" htmlFor="title">
          <input id="title" name="title" required minLength={5} maxLength={120} defaultValue={v?.title} className={inputCls} placeholder="Water shutdown in T12 on Thursday" />
        </Field>
        <Field label="Details" htmlFor="body">
          <textarea id="body" name="body" required minLength={5} maxLength={1500} rows={4} defaultValue={v?.body} className={inputCls} />
        </Field>
        <Field label="Who sees it" htmlFor="tower">
          <Select id="tower" name="tower" defaultValue={v?.tower ?? "all"}>
            <option value="all">Everyone</option>
            {Array.from({ length: 28 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Tower {String(i + 1).padStart(2, "0")} only
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="text-sm text-success" role="status">
          Posted. Residents see it on their home screen.
        </p>
      )}
      <SubmitButton className="w-full">Post notice</SubmitButton>
    </form>
  );
}
