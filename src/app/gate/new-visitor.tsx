"use client";

import { Camera, X } from "lucide-react";
import { useMemo, useState } from "react";
import { findFlatCodes } from "@/lib/bank";
import { shrinkPhoto } from "@/lib/shrink-photo";
import type { GateT, Purpose, Queued } from "./store";

const field = "h-16 w-full rounded-2xl bg-zinc-800 px-4 text-2xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#c8f26d]";

/** Full-screen entry form: photo, flat, name, purpose. Large targets for gloves and glare; works offline. */
export function NewVisitor({ t, gate, flats, onClose, onSubmit }: { t: GateT; gate: number; flats: string[]; onClose: () => void; onSubmit: (q: Queued) => void }) {
  const [photo, setPhoto] = useState<Blob | undefined>();
  const [flatRaw, setFlatRaw] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("DELIVERY");
  const flatId = findFlatCodes(/^\s*\d/.test(flatRaw) ? `T${flatRaw}` : flatRaw)[0];
  const flatOk = !!flatId && (flats.length === 0 || flats.includes(flatId));
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-zinc-950 px-4 pb-10 pt-4">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{t("newVisitor")}</h2>
          <button onClick={onClose} className="rounded-full bg-zinc-800 p-3" aria-label={t("cancel")}>
            <X className="size-6" />
          </button>
        </div>
        <label className="relative flex h-48 cursor-pointer items-center justify-center overflow-hidden rounded-3xl bg-zinc-800 text-xl font-semibold">
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={preview} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-base">
                <Camera className="size-5" aria-hidden /> {t("retake")}
              </span>
            </>
          ) : (
            <span className="flex flex-col items-center gap-2">
              <Camera className="size-10" aria-hidden /> {t("photo")}
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setPhoto(await shrinkPhoto(f, { max: 960, brighten: true }).catch(() => f));
            }}
          />
        </label>
        <div>
          <label className="mb-1 block text-zinc-400" htmlFor="flat">
            {t("flat")}
          </label>
          <input id="flat" value={flatRaw} onChange={(e) => setFlatRaw(e.target.value.toUpperCase())} placeholder={t("flatHint")} className={field} autoComplete="off" />
          {flatRaw && <p className={`mt-1 text-lg ${flatOk ? "text-emerald-400" : "text-red-400"}`}>{flatOk ? `✓ ${flatId}` : t("noFlat")}</p>}
        </div>
        <div>
          <label className="mb-1 block text-zinc-400" htmlFor="vname">
            {t("name")}
          </label>
          <input id="vname" value={name} onChange={(e) => setName(e.target.value)} className={field} autoComplete="off" />
        </div>
        <div>
          <p className="mb-1 text-zinc-400">{t("purposeLabel")}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {(["DELIVERY", "GUEST", "CAB", "SERVICE", "OTHER"] as Purpose[]).map((p) => (
              <button key={p} onClick={() => setPurpose(p)} aria-pressed={purpose === p} className={`h-14 rounded-full text-lg font-semibold ${purpose === p ? "bg-[#c8f26d] text-zinc-950" : "bg-zinc-800"}`}>
                {t(p)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-zinc-400" htmlFor="vphone">
            {t("phone")}
          </label>
          <input id="vphone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(-10))} inputMode="numeric" className={field} />
        </div>
        <button
          disabled={!flatOk || name.trim().length < 2}
          onClick={() => onSubmit({ clientId: crypto.randomUUID(), flatId: flatId!, name: name.trim(), phone: /^[6-9]\d{9}$/.test(phone) ? phone : "", purpose, gate, arrivedAt: new Date().toISOString(), outcome: "PENDING", photo })}
          className="h-20 w-full rounded-full bg-[#c8f26d] text-2xl font-bold text-zinc-950 disabled:opacity-40"
        >
          {t("ask")}
        </button>
        <p className="text-center text-sm text-zinc-500">{t("notice")}</p>
      </div>
    </div>
  );
}
