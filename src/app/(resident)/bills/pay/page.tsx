import { CircleX } from "lucide-react";
import type { Metadata } from "next";
import { Notice, PageTitle } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { flatPosition } from "@/lib/data";
import { getT } from "@/lib/lang";
import { rupees } from "@/lib/money";
import { PayForm } from "./pay-form";

export const metadata: Metadata = { title: "Pay" };

export default async function PayPage({ searchParams }: { searchParams: Promise<{ failed?: string }> }) {
  const { flat } = await requireResident();
  const t = await getT();
  const pos = await flatPosition(flat.flatId);
  const failed = (await searchParams).failed === "1";
  return (
    <div>
      <PageTitle title={t("pay.title")} subtitle={flat.flatId} back={{ href: "/bills", label: t("common.back") }} />
      {failed && (
        <Notice tone="red" icon={<CircleX className="size-4" aria-hidden />} className="mb-4">
          {t("pay.failed")}
        </Notice>
      )}
      {pos.balance <= 0 && <p className="mb-3 text-[15px] text-zinc-600">{t("pay.nothingDue")}</p>}
      <PayForm
        balance={pos.balance}
        balanceLabel={rupees(Math.max(0, pos.balance))}
        s={{ full: t("pay.full"), other: t("pay.other"), amount: t("pay.amount"), continue: t("pay.continue"), test: t("pay.test"), error: t("pay.err.amount") }}
      />
    </div>
  );
}
