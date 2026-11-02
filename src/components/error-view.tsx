"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./ui";

/** Shown when a page fails to load: says so plainly, offers a retry, never shows a stack trace. */
export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div className="mx-auto max-w-md py-16 text-center" role="alert">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 text-red-700">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold">{offline ? "You're offline" : "Something went wrong"}</h1>
      <p className="mt-2 text-[15px] text-zinc-600">
        {offline ? "Check your internet connection and try again." : "This page didn't load. Please try again. If it keeps happening, call the help desk (intercom 9)."}
      </p>
      {error.digest && <p className="mt-2 text-xs text-zinc-400">Reference: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        <RefreshCw className="size-4" aria-hidden /> Try again
      </Button>
    </div>
  );
}
