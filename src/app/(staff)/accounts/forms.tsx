"use client";

import { Upload } from "lucide-react";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { cx, fieldCls } from "@/components/ui";
import { postToTypedFlat, reverse, uploadStatement, type FormState } from "./actions";

export function UploadForm() {
  const [state, action] = useActionState(uploadStatement, {} as FormState);
  return (
    <form action={action} className="space-y-3">
      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        className="block w-full text-sm text-ink-2 file:mr-3 file:h-10 file:cursor-pointer file:rounded-full file:border-0 file:bg-muted file:px-4 file:text-sm file:font-semibold file:text-ink hover:file:bg-ink/10"
      />
      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton className="w-full sm:w-auto">
        <Upload className="size-4" aria-hidden /> Import and match
      </SubmitButton>
    </form>
  );
}

export function OtherFlatForm({ txnId }: { txnId: number }) {
  const [state, action] = useActionState(postToTypedFlat.bind(null, txnId), {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor={`flat-${txnId}`}>
          Flat number
        </label>
        {/* Keyed on the last try, so a mistyped flat stays in the box to correct instead of vanishing. */}
        <input key={state.value} id={`flat-${txnId}`} name="flatId" required defaultValue={state.value} placeholder="Another flat, e.g. T07-1203" className={cx(fieldCls, "w-full")} />
        {state.error && (
          <p className="mt-1 text-xs text-danger" role="alert">
            {state.error}
          </p>
        )}
      </div>
      <SubmitButton size="sm" variant="secondary">
        Post
      </SubmitButton>
    </form>
  );
}

export function ReverseForm({ paymentId }: { paymentId: number }) {
  const [state, action] = useActionState(reverse.bind(null, paymentId), {} as FormState);
  if (state.ok) return <p className="text-xs text-success">{state.ok}</p>;
  return (
    <details className="text-left">
      <summary className="cursor-pointer text-xs font-medium text-danger">Reverse</summary>
      <form action={action} className="mt-2 flex gap-2">
        <input key={state.value} name="reason" required minLength={5} defaultValue={state.value} placeholder="Why? e.g. belongs to T07-1204" className={cx(fieldCls, "flex-1")} />
        <SubmitButton size="sm" variant="danger">
          Reverse
        </SubmitButton>
      </form>
      {state.error && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {state.error}
        </p>
      )}
    </details>
  );
}
