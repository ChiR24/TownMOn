"use client";

import { KeyRound, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CodeEntry } from "./code-entry";
import { NewVisitor } from "./new-visitor";
import { Face, GateHeader, InsideList, IntercomButtons } from "./parts";
import { kvGet, kvSet, sha256, type Code, type Entry, type Outcome, type Queued } from "./store";
import { GATE_TEXT, type GateKey, type GateLang } from "./strings";

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

  // With the network down, a guest code is checked against the hashes the tablet already holds.
  const checkOffline = async (code: string) => {
    const at = Date.now();
    for (const c of codes) {
      if (at < new Date(c.validFrom).getTime() || at >= new Date(c.validTo).getTime()) continue;
      if ((await sha256(`${c.salt}:${code}`)) === c.hash) {
        await saveQueue([...queueRef.current, { clientId: `code-${c.id}`, flatId: c.flatId, name: c.guestName, phone: "", purpose: "GUEST", gate, arrivedAt: new Date().toISOString(), outcome: "CODE", guestCodeId: c.id }]);
        setCodes(codes.filter((x) => x.id !== c.id));
        return { ok: true as const, guestName: c.guestName, flatId: c.flatId };
      }
    }
    return { error: "invalid" as const };
  };
  const checkOnline = async (code: string) => {
    const r = await fetch("/api/gate/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, gate }) });
    const data = await r.json();
    refresh();
    return data;
  };

  const settleQueued = async (clientId: string, outcome: Outcome) => saveQueue(queueRef.current.map((x) => (x.clientId === clientId ? { ...x, outcome } : x)));
  const waiting = entries.filter((e) => e.status === "PENDING");
  const decided = entries.filter((e) => (e.status === "APPROVED" || e.status === "DENIED") && now - new Date(e.arrivedAt).getTime() < 30 * 60_000);
  const mins = (iso: string) => Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-3 text-zinc-100">
      <GateHeader t={t} gate={gate} onGate={(g) => (setGate(g), localStorage.setItem("gate", String(g)))} online={online} toSync={queue.length} lang={lang} onLang={setLang} />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={() => setView("new")} className="flex h-28 flex-col items-center justify-center gap-2 rounded-[32px] bg-[#c8f26d] text-xl font-semibold text-zinc-950 active:brightness-95">
          <UserPlus className="size-8" aria-hidden /> {t("newVisitor")}
        </button>
        <button onClick={() => setView("code")} className="flex h-28 flex-col items-center justify-center gap-2 rounded-[32px] bg-zinc-800 text-xl font-semibold text-white active:bg-zinc-700">
          <KeyRound className="size-8" aria-hidden /> {t("guestCode")}
        </button>
      </div>

      {decided.map((e) => (
        <div key={e.id} className={`mt-3 flex items-center gap-4 rounded-[28px] p-4 ${e.status === "APPROVED" ? "bg-emerald-900" : "bg-red-950"}`}>
          <Face entry={e} />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold">{e.name}</p>
            <p className="text-zinc-300">
              {e.flatId} · {e.status === "APPROVED" ? t("approved") : t("denied")}
            </p>
          </div>
          {e.status === "APPROVED" ? (
            <button onClick={() => act(e.id, "enter")} className="h-16 rounded-full bg-emerald-400 px-7 text-xl font-bold text-zinc-950">
              {t("letIn")}
            </button>
          ) : (
            <span className="rounded-full bg-red-500 px-5 py-3 text-lg font-bold text-white">{t("doNotLetIn")}</span>
          )}
        </div>
      ))}

      <h2 className="mb-2 mt-7 text-sm font-semibold uppercase tracking-wide text-zinc-400">{t("waiting")}</h2>
      {waiting.length + queue.length === 0 && <p className="text-zinc-500">{t("nobody")}</p>}
      <ul className="space-y-3">
        {queue.map((q) => (
          <li key={q.clientId} className="rounded-[28px] bg-zinc-800 p-4">
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
          <li key={e.id} className="rounded-[28px] bg-zinc-800 p-4">
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

      <InsideList t={t} inside={entries.filter((e) => e.status === "INSIDE")} onLeft={(id) => act(id, "left")} />

      <footer className="mt-8 flex items-center justify-between text-xs text-zinc-500">
        <span>{guardName}</span>
        <a href="/gate/notice" className="underline">
          {t("noticeLink")}
        </a>
      </footer>

      {view === "new" && <NewVisitor t={t} gate={gate} flats={flats} onClose={() => setView("home")} onSubmit={(q) => (setView("home"), record(q))} />}
      {view === "code" && <CodeEntry t={t} online={online} onClose={() => setView("home")} onOffline={checkOffline} onOnline={checkOnline} />}
      {toast && (
        <div role="status" className={`fixed inset-x-4 bottom-4 mx-auto max-w-xl rounded-[24px] px-5 py-4 text-lg font-semibold shadow-2xl ${toast.ok ? "bg-[#c8f26d] text-zinc-950" : "bg-red-500 text-white"}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
