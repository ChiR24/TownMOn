"use client";

import { Upload } from "lucide-react";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { inputCls } from "@/components/ui";
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
        className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-200"
      />
      {state.error && (
        <p className="text-sm text-red-700" role="alert">
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
        <input id={`flat-${txnId}`} name="flatId" required placeholder="Another flat, e.g. T07-1203" className={`${inputCls} py-2 text-sm`} />
        {state.error && <p className="mt-1 text-xs text-red-700">{state.error}</p>}
      </div>
      <SubmitButton size="sm" variant="secondary" className="h-10">
        Post
      </SubmitButton>
    </form>
  );
}

export function ReverseForm({ paymentId }: { paymentId: number }) {
  const [state, action] = useActionState(reverse.bind(null, paymentId), {} as FormState);
  if (state.ok) return <p className="text-xs text-emerald-700">{state.ok}</p>;
  return (
    <details className="text-left">
      <summary className="cursor-pointer text-xs font-medium text-red-700">Reverse</summary>
      <form action={action} className="mt-2 flex gap-2">
        <input name="reason" required minLength={5} placeholder="Why? e.g. belongs to T07-1204" className={`${inputCls} py-1.5 text-sm`} />
        <SubmitButton size="sm" variant="danger">
          Reverse
        </SubmitButton>
      </form>
      {state.error && <p className="mt-1 text-xs text-red-700">{state.error}</p>}
    </details>
  );
}
