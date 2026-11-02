"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./ui";

// The error screen can't reach the server for translations, so it carries its own three languages.
const TEXT = {
  en: { title: "Something went wrong", body: "This page didn't load. Please try again. If it keeps happening, call the help desk.", offTitle: "You're offline", offBody: "Check your internet connection and try again.", retry: "Try again", ref: "Reference" },
  mr: { title: "काहीतरी चुकले", body: "हे पान उघडले नाही. पुन्हा प्रयत्न करा. असे होत राहिल्यास हेल्प डेस्कला फोन करा.", offTitle: "इंटरनेट बंद आहे", offBody: "इंटरनेट तपासून पुन्हा प्रयत्न करा.", retry: "पुन्हा प्रयत्न करा", ref: "संदर्भ" },
  hi: { title: "कुछ गड़बड़ हो गई", body: "यह पेज नहीं खुला। फिर से कोशिश करें। बार-बार ऐसा हो तो हेल्प डेस्क को फ़ोन करें।", offTitle: "इंटरनेट बंद है", offBody: "इंटरनेट जाँचकर फिर से कोशिश करें।", retry: "फिर से कोशिश करें", ref: "संदर्भ" },
};

/** Shown when a page fails to load: says so plainly, offers a retry, never shows a stack trace. */
export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  const lang = typeof document === "undefined" ? "en" : document.documentElement.lang.slice(0, 2);
  const s = TEXT[lang as keyof typeof TEXT] ?? TEXT.en;
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center" role="alert">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-50 text-red-700 dark:bg-red-400/12 dark:text-red-300">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{offline ? s.offTitle : s.title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{offline ? s.offBody : s.body}</p>
      {error.digest && (
        <p className="mt-2 text-xs text-ink-3">
          {s.ref}: {error.digest}
        </p>
      )}
      <Button className="mt-7" onClick={reset}>
        <RefreshCw className="size-4" aria-hidden /> {s.retry}
      </Button>
    </div>
  );
}
