import type { T } from "@/lib/i18n";
import { Badge, type Tone } from "./ui";

const COMPLAINT_TONE: Record<string, Tone> = { OPEN: "sky", ASSIGNED: "sky", IN_PROGRESS: "amber", RESOLVED: "violet", CLOSED: "zinc" };
const VISITOR_TONE: Record<string, Tone> = { PENDING: "amber", APPROVED: "brand", DENIED: "red", INSIDE: "emerald", LEFT: "zinc" };

export function ComplaintStatus({ status, t }: { status: string; t: T }) {
  return <Badge tone={COMPLAINT_TONE[status]}>{t(`c.status.${status}` as never)}</Badge>;
}

export function VisitorStatus({ status, t }: { status: string; t: T }) {
  return <Badge tone={VISITOR_TONE[status]}>{t(`v.status.${status}` as never)}</Badge>;
}
