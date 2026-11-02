"use client";

import { CloudOff, Phone, Wifi } from "lucide-react";
import { useMemo } from "react";
import type { Entry, GateT } from "./store";
import type { GateLang } from "./strings";

const LIME = "bg-[#c8f26d] text-zinc-950";

/** Gate picker, connection state and language: everything the guard sets once per shift. */
export function GateHeader({ t, gate, onGate, online, toSync, lang, onLang }: { t: GateT; gate: number; onGate: (g: number) => void; online: boolean; toSync: number; lang: GateLang; onLang: (l: GateLang) => void }) {
  return (
    <header className="flex flex-wrap items-center gap-3">
      <div className="flex rounded-full bg-zinc-800 p-1">
        {[1, 2, 3, 4].map((g) => (
          <button key={g} onClick={() => onGate(g)} className={`h-12 min-w-14 rounded-full px-4 text-lg font-semibold ${g === gate ? LIME : "text-zinc-300"}`} aria-pressed={g === gate}>
            {t("gate")} {g}
          </button>
        ))}
      </div>
      <span className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${online ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-200"}`}>
        {online ? <Wifi className="size-4" aria-hidden /> : <CloudOff className="size-4" aria-hidden />}
        {online ? t("online") : t("offline")}
        {toSync > 0 && ` · ${t("toSync", { n: toSync })}`}
      </span>
      <div className="ml-auto flex gap-1 rounded-full bg-zinc-900 p-1 text-sm">
        {(["en", "mr", "hi"] as GateLang[]).map((l) => (
          <button key={l} onClick={() => onLang(l)} aria-pressed={l === lang} className={`rounded-full px-3 py-1.5 font-semibold ${l === lang ? "bg-zinc-700 text-white" : "text-zinc-400"}`}>
            {l === "en" ? "EN" : l === "mr" ? "मराठी" : "हिंदी"}
          </button>
        ))}
      </div>
    </header>
  );
}

/** When the resident hasn't answered in two minutes, the guard settles it on the intercom. */
export function IntercomButtons({ t, onApprove, onDeny }: { t: GateT; onApprove: () => void; onDeny: () => void }) {
  return (
    <div className="mt-3">
      <p className="mb-2 flex items-center gap-2 text-sm text-amber-200">
        <Phone className="size-4" aria-hidden /> {t("noAnswer")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onApprove} className="h-14 rounded-full bg-emerald-500 text-lg font-semibold text-zinc-950">
          {t("approvedCall")}
        </button>
        <button onClick={onDeny} className="h-14 rounded-full bg-zinc-700 text-lg font-semibold">
          {t("deniedCall")}
        </button>
      </div>
    </div>
  );
}

/** The visitor's photo (from the server, or still on the tablet), or their initial. */
export function Face({ entry, blob, small }: { entry: { name: string; photoId: number | null }; blob?: Blob; small?: boolean }) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : entry.photoId ? `/api/photos/${entry.photoId}` : null), [blob, entry.photoId]);
  const size = small ? "size-12 text-base" : "size-20 text-2xl";
  // eslint-disable-next-line @next/next/no-img-element -- private photo route / local blob
  return url ? <img src={url} alt="" className={`${size} shrink-0 rounded-2xl object-cover`} /> : <span className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-zinc-700 font-semibold`}>{entry.name.slice(0, 1).toUpperCase()}</span>;
}

/** Everyone inside right now (whichever gate they came in by), each with the one button the guard needs when they leave. */
export function InsideList({ t, inside, gate, onLeft }: { t: GateT; inside: Entry[]; gate: number; onLeft: (id: number) => void }) {
  return (
    <>
      <h2 className="mb-2 mt-7 text-sm font-semibold uppercase tracking-wide text-zinc-400">{t("inside")}</h2>
      {inside.length === 0 && <p className="text-zinc-500">{t("nobodyInside")}</p>}
      <ul className="divide-y divide-zinc-800 rounded-3xl bg-zinc-900">
        {inside.map((e) => (
          <li key={e.id} className="flex items-center gap-3 p-3">
            <Face entry={e} small />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-medium">{e.name}</p>
              <p className="text-sm text-zinc-400">
                {e.flatId} · {t(e.purpose)}
                {e.approvalMode === "CODE" && ` · ${t("guestCode")}`}
                {e.gate && e.gate !== gate && ` · ${t("gate")} ${e.gate}`}
              </p>
            </div>
            <button onClick={() => onLeft(e.id)} aria-label={`${t("left")}: ${e.name}`} className="h-12 rounded-full bg-zinc-700 px-6 text-lg font-semibold">
              {t("left")}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
