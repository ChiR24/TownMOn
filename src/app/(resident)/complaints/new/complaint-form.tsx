"use client";

import { Camera, X } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { cx, Field, IconChip, inputCls } from "@/components/ui";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { submitComplaint, type State } from "../actions";

type S = Record<"what" | "whatHint" | "photo" | "photoHint" | "send" | "errShort" | "errPhoto", string>;

export function ComplaintForm({ s }: { s: S }) {
  const [state, action] = useActionState(submitComplaint, {} as State);
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const file = el.files?.[0];
    if (!file) return setPreview(null);
    try {
      const small = await shrinkPhoto(file);
      const dt = new DataTransfer();
      dt.items.add(small);
      el.files = dt.files; // upload the ~150 KB version, not the camera original
      setPreview(URL.createObjectURL(small));
    } catch {
      setPreview(URL.createObjectURL(file)); // the server re-checks the bytes either way
    }
  }

  return (
    <form action={action} className="space-y-5">
      <Field label={s.what} hint={s.whatHint} error={state.error === "short" ? s.errShort : undefined} htmlFor="description">
        <textarea id="description" name="description" required minLength={5} maxLength={1000} rows={5} className={cx(inputCls, "!rounded-[24px]")} autoFocus />
      </Field>
      <div>
        <p className="mb-2 px-1 text-sm font-medium text-ink-2">{s.photo}</p>
        <input ref={input} id="photo" type="file" name="photo" accept="image/*" className="sr-only" onChange={onPick} />
        {preview ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
            <img src={preview} alt="" className="h-36 rounded-[20px] object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => {
                if (input.current) input.current.value = "";
                setPreview(null);
              }}
              className="absolute -right-2 -top-2 rounded-full bg-zinc-900 p-1 text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label htmlFor="photo" className="press flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-[24px] border-2 border-dashed border-ink/12 bg-surface/60 px-4 py-6 text-center text-sm text-ink-2 hover:bg-surface dark:border-line">
            <IconChip tone="peach" className="size-12">
              <Camera className="size-5" aria-hidden />
            </IconChip>
            {s.photoHint}
          </label>
        )}
        {state.error === "photo" && <p className="mt-1.5 text-sm text-red-700 dark:text-red-300">{s.errPhoto}</p>}
      </div>
      <SubmitButton size="lg" className="w-full">
        {s.send}
      </SubmitButton>
    </form>
  );
}
