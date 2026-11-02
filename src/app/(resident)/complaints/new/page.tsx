import type { Metadata } from "next";
import { AiNote } from "@/components/ai";
import { PageTitle } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { translator } from "@/lib/i18n";
import { ComplaintForm } from "./complaint-form";

export const metadata: Metadata = { title: "New complaint" };

export default async function NewComplaintPage() {
  const { flat } = await requireResident();
  const lang = await getLang();
  const t = translator(lang);
  return (
    <div>
      <PageTitle title={t("c.new")} subtitle={flat.flatId} back={{ href: "/complaints", label: t("common.back") }} />
      <AiNote className="mb-5" title={t("c.aiHelp.title")}>
        {t("c.aiHelp.body")}
      </AiNote>
      <ComplaintForm
        lang={lang}
        s={{
          what: t("c.what"),
          whatHint: t("c.whatHint"),
          photo: t("c.photo"),
          photoHint: t("c.photoHint"),
          send: t("c.send"),
          errShort: t("c.err.short"),
          errPhoto: t("c.err.photo"),
          speak: t("c.speak"),
          listening: t("c.listening"),
          removePhoto: t("c.removePhoto"),
        }}
      />
    </div>
  );
}
