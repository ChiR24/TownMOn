"use client";

import { Camera, Check, CircleCheck, CloudOff, Delete, KeyRound, Phone, UserPlus, Wifi, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findFlatCodes } from "@/lib/bank";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { GATE_TEXT, type GateKey, type GateLang } from "./strings";

type Purpose = "GUEST" | "DELIVERY" | "CAB" | "SERVICE" | "OTHER";
type Outcome = "PENDING" | "INTERCOM_APPROVED" | "INTERCOM_DENIED" | "CODE";
type Entry = { id: number; clientId: string; flatId: string; name: string; purpose: Purpose; status: string; approvalMode: string | null; photoId: number | null; arrivedAt: string };
type Code = { id: number; flatId: string; guestName: string; salt: string; hash: string; validFrom: string; validTo: string };
type Queued = { clientId: string; flatId: string; name: string; phone: string; purpose: Purpose; gate: number; arrivedAt: string; outcome: Outcome; guestCodeId?: number; photo?: Blob };

// ---- a tiny IndexedDB key-value store: survives reloads and network drops ----
const open = () =>
  new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open("gate", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((res) => {
    const q = db.transaction("kv").objectStore("kv").get(key);
    q.onsuccess = () => res(q.result as T);
    q.onerror = () => res(undefined);
  });
}
async function kvSet(key: string, value: unknown) {
  const db = await open();
  return new Promise<void>((res) => {
    const t = db.transaction("kv", "readwrite");
    t.objectStore("kv").put(value, key);
    t.oncomplete = () => res();
    t.onerror = () => res();
  });
}
const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");

export function GateApp({ guardName, initialLang }: { guardName: string; initialLang: GateLang }) {
  const [lang, setLang] = useState<GateLang>(initialLang);
  const t = useCallback((k: GateKey, v: Record<string, string | number> = {}) => GATE_TEXT[lang][k].replace(/\{(\w+)\}/g, (_, x: string) => String(v[x] ?? "")), [lang]);
  const [gate, setGate] = useState(1);
  const [online, setOnline] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [flats, setFlats] = useState<string[]>([]);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [view, setView] = useState<"home" | "new" | "code">("home");
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [now, setNow] = useState(0); // ticks with each poll, so "waiting 3 min" stays honest without impure renders
  const queueRef = useRef<Queued[]>([]);
  const router = useRouter();

  const say = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 5000);
  };
  const saveQueue = async (q: Queued[]) => {
    queueRef.current = q;
    setQueue(q);
    await kvSet("queue", q);
  };

  // Load what the tablet remembers (localStorage, IndexedDB), then keep it fresh.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the tablet's saved gate once, after hydration
    setGate(Number(localStorage.getItem("gate")) || 1);
    (async () => {
      queueRef.current = (await kvGet<Queued[]>("queue")) ?? [];
      setQueue(queueRef.current);
      const cached = await kvGet<{ entries: Entry[]; codes: Code[] }>("feed");
      if (cached) {
        setEntries(cached.entries);
        setCodes(cached.codes);
      }
      setFlats((await kvGet<string[]>("flats")) ?? []);
    })();
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/gate-sw.js", { scope: "/gate" }).catch(() => {});
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener("online", on);
    addEventListener("offline", off);
    return () => {
      removeEventListener("online", on);
      removeEventListener("offline", off);
    };
  }, []);

  const send = useCallback(async (q: Queued) => {
    const form = new FormData();
    const { photo, ...entry } = q;
    form.set("entry", JSON.stringify(entry));
    if (photo) form.set("photo", photo, "photo.jpg");
    const r = await fetch("/api/gate/visitors", { method: "POST", body: form });
    if (r.status >= 500) throw new Error("server");
    return r;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/gate/feed?gate=${gate}${flats.length ? "" : "&flats=1"}`, { cache: "no-store" });
      if (r.status === 403) return router.push("/login");
      const data = await r.json();
      setEntries(data.entries);
      setCodes(data.codes);
      setNow(Date.now());
      await kvSet("feed", { entries: data.entries, codes: data.codes });
      if (data.flats) {
        setFlats(data.flats);
        await kvSet("flats", data.flats);
      }
      setOnline(true);
      // Back online: replay the offline queue. Same clientId -> the server records each entry once.
      let q = queueRef.current;
      for (const item of q) {
        try {
          await send(item);
          q = q.filter((x) => x.clientId !== item.clientId);
          await saveQueue(q);
        } catch {
          break;
        }
      }
    } catch {
      setOnline(false);
      setNow(Date.now());
    }
  }, [gate, flats.length, send, router]);

  // Poll every 5 s: the gate's equivalent of a live feed, and the moment queued entries get replayed.
  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh]);

  const act = async (id: number, action: string) => {
    try {
      await fetch(`/api/gate/visitors/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    } finally {
      refresh();
    }
  };

  const record = async (q: Queued) => {
    try {
      const r = await send(q);
      if (!r.ok) return say((await r.json()).error ?? "Error", false);
      say(q.outcome === "PENDING" ? t("sent", { flat: q.flatId }) : t("letIn"));
      refresh();
    } catch {
      await saveQueue([...queueRef.current, q]);
      setOnline(false);
      say(t("savedHere"));
    }
  };

  const settleQueued = async (clientId: string, outcome: Outcome) => saveQueue(queueRef.current.map((x) => (x.clientId === clientId ? { ...x, outcome } : x)));

  const waiting = entries.filter((e) => e.status === "PENDING");
  const decided = entries.filter((e) => (e.status === "APPROVED" || e.status === "DENIED") && now - new Date(e.arrivedAt).getTime() < 30 * 60_000);
  const inside = entries.filter((e) => e.status === "INSIDE");
  const mins = (iso: string) => Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-3 text-zinc-100">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-2xl bg-zinc-800 p-1">
          {[1, 2, 3, 4].map((g) => (
            <button
              key={g}
              onClick={() => (setGate(g), localStorage.setItem("gate", String(g)))}
              className={`h-12 min-w-14 rounded-xl px-3 text-lg font-semibold ${g === gate ? "bg-teal-500 text-zinc-950" : "text-zinc-300"}`}
              aria-pressed={g === gate}
            >
              {t("gate")} {g}
            </button>
          ))}
        </div>
        <span className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ${online ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-200"}`}>
          {online ? <Wifi className="size-4" aria-hidden /> : <CloudOff className="size-4" aria-hidden />}
          {online ? t("online") : t("offline")}
          {queue.length > 0 && ` · ${t("toSync", { n: queue.length })}`}
        </span>
        <div className="ml-auto flex gap-1 text-sm">
          {(["en", "mr", "hi"] as GateLang[]).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`rounded-lg px-2.5 py-1.5 ${l === lang ? "bg-zinc-700 text-white" : "text-zinc-400"}`}>
              {l === "en" ? "EN" : l === "mr" ? "मराठी" : "हिंदी"}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={() => setView("new")} className="flex h-28 flex-col items-center justify-center gap-2 rounded-3xl bg-teal-500 text-xl font-semibold text-zinc-950 active:bg-teal-400">
          <UserPlus className="size-8" aria-hidden /> {t("newVisitor")}
        </button>
        <button onClick={() => setView("code")} className="flex h-28 flex-col items-center justify-center gap-2 rounded-3xl bg-zinc-800 text-xl font-semibold text-white active:bg-zinc-700">
          <KeyRound className="size-8" aria-hidden /> {t("guestCode")}
        </button>
      </div>

      {[...decided].map((e) => (
        <div key={e.id} className={`mt-3 flex items-center gap-4 rounded-3xl p-4 ${e.status === "APPROVED" ? "bg-emerald-900" : "bg-red-950"}`}>
          <Face entry={e} />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold">{e.name}</p>
            <p className="text-zinc-300">
              {e.flatId} · {e.status === "APPROVED" ? t("approved") : t("denied")}
            </p>
          </div>
          {e.status === "APPROVED" ? (
            <button onClick={() => act(e.id, "enter")} className="h-16 rounded-2xl bg-emerald-400 px-6 text-xl font-bold text-zinc-950">
              {t("letIn")}
            </button>
          ) : (
            <span className="rounded-2xl bg-red-500 px-4 py-3 text-lg font-bold text-white">{t("doNotLetIn")}</span>
          )}
        </div>
      ))}

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-400">{t("waiting")}</h2>
      {waiting.length + queue.length === 0 && <p className="text-zinc-500">{t("nobody")}</p>}
      <ul className="space-y-3">
        {queue.map((q) => (
          <li key={q.clientId} className="rounded-3xl bg-zinc-800 p-4">
            <div className="flex items-center gap-4">
              <Face entry={{ name: q.name, photoId: null }} blob={q.photo} />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold">{q.name}</p>
                <p className="text-zinc-400">
                  {q.flatId} · {t(q.purpose)} · <span className="text-amber-300">{t("savedHere")}</span>
                </p>
              </div>
              {q.outcome !== "PENDING" && <span className="text-lg font-semibold">{q.outcome === "INTERCOM_DENIED" ? t("doNotLetIn") : t("letIn")}</span>}
            </div>
            {q.outcome === "PENDING" && <IntercomButtons t={t} onApprove={() => settleQueued(q.clientId, "INTERCOM_APPROVED")} onDeny={() => settleQueued(q.clientId, "INTERCOM_DENIED")} />}
          </li>
        ))}
        {waiting.map((e) => (
          <li key={e.id} className="rounded-3xl bg-zinc-800 p-4">
            <div className="flex items-center gap-4">
              <Face entry={e} />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold">{e.name}</p>
                <p className="text-zinc-400">
                  {e.flatId} · {t(e.purpose)} · {t("min", { n: mins(e.arrivedAt) })}
                </p>
              </div>
            </div>
            {mins(e.arrivedAt) >= 2 && <IntercomButtons t={t} onApprove={() => act(e.id, "intercom-approve")} onDeny={() => act(e.id, "intercom-deny")} />}
          </li>
        ))}
      </ul>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-400">{t("inside")}</h2>
      <ul className="divide-y divide-zinc-800 rounded-3xl bg-zinc-900">
        {inside.map((e) => (
          <li key={e.id} className="flex items-center gap-3 p-3">
            <Face entry={e} small />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-medium">{e.name}</p>
              <p className="text-sm text-zinc-400">
                {e.flatId} · {t(e.purpose)}
                {e.approvalMode === "CODE" && " · code"}
              </p>
            </div>
            <button onClick={() => act(e.id, "left")} className="h-12 rounded-xl bg-zinc-700 px-5 text-lg font-medium">
              {t("left")}
            </button>
          </li>
        ))}
      </ul>

      <footer className="mt-8 flex items-center justify-between text-xs text-zinc-500">
        <span>{guardName}</span>
        <a href="/gate/notice" className="underline">
          {t("noticeLink")}
        </a>
      </footer>

      {view === "new" && <NewVisitor t={t} gate={gate} flats={flats} onClose={() => setView("home")} onSubmit={(q) => (setView("home"), record(q))} />}
      {view === "code" && (
        <CodeEntry
          t={t}
          online={online}
          onClose={() => setView("home")}
          onOffline={async (code) => {
            const now = Date.now();
            for (const c of codes) {
              if (now < new Date(c.validFrom).getTime() || now >= new Date(c.validTo).getTime()) continue;
              if ((await sha256(`${c.salt}:${code}`)) === c.hash) {
                await saveQueue([...queueRef.current, { clientId: `code-${c.id}`, flatId: c.flatId, name: c.guestName, phone: "", purpose: "GUEST", gate, arrivedAt: new Date().toISOString(), outcome: "CODE", guestCodeId: c.id }]);
                setCodes(codes.filter((x) => x.id !== c.id));
                return { ok: true as const, guestName: c.guestName, flatId: c.flatId };
              }
            }
            return { error: "invalid" as const };
          }}
          onOnline={async (code) => {
            const r = await fetch("/api/gate/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, gate }) });
            const data = await r.json();
            refresh();
            return data;
          }}
        />
      )}
      {toast && (
        <div role="status" className={`fixed inset-x-4 bottom-4 mx-auto max-w-xl rounded-2xl px-5 py-4 text-lg font-medium shadow-2xl ${toast.ok ? "bg-emerald-400 text-zinc-950" : "bg-red-500 text-white"}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

function IntercomButtons({ t, onApprove, onDeny }: { t: (k: GateKey) => string; onApprove: () => void; onDeny: () => void }) {
  return (
    <div className="mt-3">
      <p className="mb-2 flex items-center gap-2 text-sm text-amber-200">
        <Phone className="size-4" aria-hidden /> {t("noAnswer")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onApprove} className="h-14 rounded-2xl bg-emerald-500 text-lg font-semibold text-zinc-950">
          {t("approvedCall")}
        </button>
        <button onClick={onDeny} className="h-14 rounded-2xl bg-zinc-700 text-lg font-semibold">
          {t("deniedCall")}
        </button>
      </div>
    </div>
  );
}

function Face({ entry, blob, small }: { entry: { name: string; photoId: number | null }; blob?: Blob; small?: boolean }) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : entry.photoId ? `/api/photos/${entry.photoId}` : null), [blob, entry.photoId]);
  const size = small ? "size-12 text-base" : "size-20 text-2xl";
  // eslint-disable-next-line @next/next/no-img-element -- private photo route / local blob
  return url ? <img src={url} alt="" className={`${size} shrink-0 rounded-2xl object-cover`} /> : <span className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-zinc-700 font-semibold`}>{entry.name.slice(0, 1).toUpperCase()}</span>;
}

function NewVisitor({ t, gate, flats, onClose, onSubmit }: { t: (k: GateKey, v?: Record<string, string | number>) => string; gate: number; flats: string[]; onClose: () => void; onSubmit: (q: Queued) => void }) {
  const [photo, setPhoto] = useState<Blob | undefined>();
  const [flatRaw, setFlatRaw] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("DELIVERY");
  const flatId = findFlatCodes(/^\s*\d/.test(flatRaw) ? `T${flatRaw}` : flatRaw)[0];
  const flatOk = !!flatId && (flats.length === 0 || flats.includes(flatId));
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  const field = "h-16 w-full rounded-2xl bg-zinc-800 px-4 text-2xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-400";

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-zinc-950 px-4 pb-10 pt-4">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{t("newVisitor")}</h2>
          <button onClick={onClose} className="rounded-xl bg-zinc-800 p-3" aria-label={t("cancel")}>
            <X className="size-6" />
          </button>
        </div>
        <label className="flex h-48 cursor-pointer items-center justify-center overflow-hidden rounded-3xl bg-zinc-800 text-xl font-semibold">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview
            <img src={preview} alt="" className="h-full w-full object-cover" />
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
        {preview && <p className="-mt-3 text-center text-sm text-zinc-400">{t("retake")}: tap the photo</p>}
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
              <button key={p} onClick={() => setPurpose(p)} aria-pressed={purpose === p} className={`h-14 rounded-2xl text-lg font-medium ${purpose === p ? "bg-teal-500 text-zinc-950" : "bg-zinc-800"}`}>
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
          className="h-20 w-full rounded-3xl bg-teal-500 text-2xl font-bold text-zinc-950 disabled:opacity-40"
        >
          {t("ask")}
        </button>
        <p className="text-center text-sm text-zinc-500">{t("notice")}</p>
      </div>
    </div>
  );
}

type CodeResult = { ok: true; guestName: string; flatId: string } | { error: "invalid" | "used" | "expired" };

function CodeEntry({ t, online, onClose, onOnline, onOffline }: { t: (k: GateKey, v?: Record<string, string | number>) => string; online: boolean; onClose: () => void; onOnline: (c: string) => Promise<CodeResult>; onOffline: (c: string) => Promise<CodeResult> }) {
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
          <button onClick={onClose} className="rounded-xl bg-zinc-800 p-3" aria-label={t("cancel")}>
            <X className="size-6" />
          </button>
        </div>
        <p className="my-6 text-center font-mono text-6xl tracking-[0.3em] text-white" aria-live="polite">
          {code.padEnd(6, "·")}
        </p>
        {result && (
          <div className={`mb-4 flex items-center gap-3 rounded-2xl p-4 text-lg font-medium ${"ok" in result ? "bg-emerald-400 text-zinc-950" : "bg-red-500 text-white"}`}>
            {"ok" in result ? <CircleCheck className="size-7 shrink-0" /> : <X className="size-7 shrink-0" />}
            {"ok" in result ? t("codeOk", { name: result.guestName, flat: result.flatId }) : result.error === "used" ? t("codeUsed") : result.error === "expired" ? t("codeExpired") : t("codeBad")}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"].map((k) =>
            k === "ok" ? (
              <button key={k} disabled={code.length !== 6} onClick={check} className="h-20 rounded-2xl bg-teal-500 text-zinc-950 disabled:opacity-40" aria-label={t("check")}>
                <Check className="mx-auto size-8" />
              </button>
            ) : (
              <button key={k} onClick={() => key(k)} className="h-20 rounded-2xl bg-zinc-800 text-3xl font-semibold active:bg-zinc-700" aria-label={k === "del" ? "Delete" : k}>
                {k === "del" ? <Delete className="mx-auto size-8" /> : k}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
