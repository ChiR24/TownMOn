"use client";

import { Mic, Square } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";

// The browser's own speech recognition (Chrome on Android, Safari on iPhone): no extra service, nothing stored.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type Ctor = new () => Recognition;
const ctor = () => (typeof window === "undefined" ? undefined : ((window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: Ctor }).webkitSpeechRecognition));
const noop = () => () => {};

/** Speak the problem instead of typing it, in the app's language. Hidden where the phone can't do it. */
export function VoiceButton({ lang, target, labels }: { lang: string; target: string; labels: { start: string; stop: string } }) {
  const supported = useSyncExternalStore(noop, () => !!ctor(), () => false);
  const [on, setOn] = useState(false);
  const rec = useRef<Recognition | null>(null);
  if (!supported) return null;

  const toggle = () => {
    if (on) return rec.current?.stop();
    const Rec = ctor()!;
    const r = new Rec();
    r.lang = `${lang}-IN`;
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const box = document.getElementById(target) as HTMLTextAreaElement | null;
      if (!box) return;
      let said = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) said += e.results[i][0].transcript;
      box.value = [box.value.trim(), said.trim()].filter(Boolean).join(" ");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      className={`press absolute bottom-3 right-3 flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${on ? "bg-red-500 text-white" : "ai-grad text-white shadow-[0_8px_20px_-8px_rgb(109_93_252/0.7)]"}`}
    >
      {on ? (
        <>
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full rounded-full bg-white opacity-70 motion-safe:animate-ping" />
            <Square className="relative size-2.5 fill-white" aria-hidden />
          </span>
          {labels.stop}
        </>
      ) : (
        <>
          <Mic className="size-4" aria-hidden /> {labels.start}
        </>
      )}
    </button>
  );
}
