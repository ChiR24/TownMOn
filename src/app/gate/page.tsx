import type { Metadata, Viewport } from "next";
import { AREAS, requireUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { GateApp } from "./gate-app";

export const metadata: Metadata = { title: "Gate" };
export const viewport: Viewport = { themeColor: "#0d0d0c" };

// The guard tablet: the app's dark mode, always (a booth screen, day and night), with huge buttons; works through
// network drops (see gate-app.tsx and public/gate-sw.js).
export default async function GatePage() {
  const user = await requireUser(AREAS.gate);
  return (
    <div className="gate-theme min-h-dvh bg-zinc-950">
      <GateApp guardName={user.name} initialLang={await getLang()} />
    </div>
  );
}
