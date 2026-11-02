import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { getT } from "@/lib/lang";
import { ComplaintForm } from "./complaint-form";

export const metadata: Metadata = { title: "New complaint" };

export default async function NewComplaintPage() {
  const { flat } = await requireResident();
  const t = await getT();
  return (
    <div>
      <PageTitle title={t("c.new")} subtitle={flat.flatId} back={{ href: "/complaints", label: t("common.back") }} />
      <ComplaintForm
        s={{ what: t("c.what"), whatHint: t("c.whatHint"), photo: t("c.photo"), photoHint: t("c.photoHint"), send: t("c.send"), errShort: t("c.err.short"), errPhoto: t("c.err.photo") }}
      />
    </div>
  );
}
