"use client";

import { Check, CircleCheck, Delete, X } from "lucide-react";
import { useState } from "react";
import type { CodeResult, GateT } from "./store";

/** A keypad for the guest's 6-digit code. Checked on the server, or on the tablet when the network is down. */
export function CodeEntry({ t, online, onClose, onOnline, onOffline }: { t: GateT; online: boolean; onClose: () => void; onOnline: (c: string) => Promise<CodeResult>; onOffline: (c: string) => Promise<CodeResult> }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CodeResult | null>(null);
  const check = async () => {
    try {
      setResult(online ? await onOnline(code) : await onOffline(code));
    } catch {
      setResult(await onOffline(code));
    }
  };
  const key = (k: string) => {
    setResult(null);
    setCode((c) => (k === "del" ? c.slice(0, -1) : (c + k).slice(0, 6)));
  };
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-zinc-950 px-4 pb-10 pt-4">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{t("enterCode")}</h2>
          <button onClick={onClose} className="rounded-full bg-zinc-800 p-3" aria-label={t("cancel")}>
            <X className="size-6" />
          </button>
        </div>
        <p className="my-6 text-center font-mono text-6xl tracking-[0.3em] text-white" aria-live="polite">
          {code.padEnd(6, "·")}
        </p>
        {result && (
          <div className={`mb-4 flex items-center gap-3 rounded-3xl p-4 text-lg font-semibold ${"ok" in result ? "bg-emerald-400 text-zinc-950" : "bg-red-500 text-white"}`} role="status">
            {"ok" in result ? <CircleCheck className="size-7 shrink-0" /> : <X className="size-7 shrink-0" />}
            {"ok" in result ? t("codeOk", { name: result.guestName, flat: result.flatId }) : result.error === "used" ? t("codeUsed") : result.error === "expired" ? t("codeExpired") : t("codeBad")}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"].map((k) =>
            k === "ok" ? (
              <button key={k} disabled={code.length !== 6} onClick={check} className="h-20 rounded-3xl bg-[#c8f26d] text-zinc-950 disabled:opacity-40" aria-label={t("check")}>
                <Check className="mx-auto size-8" />
              </button>
            ) : (
              <button key={k} onClick={() => key(k)} className="h-20 rounded-3xl bg-zinc-800 text-3xl font-semibold active:bg-zinc-700" aria-label={k === "del" ? "Delete" : k}>
                {k === "del" ? <Delete className="mx-auto size-8" /> : k}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
