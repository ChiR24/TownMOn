import { Logo } from "@/components/brand";
import { LinkButton } from "@/components/ui";
import { getT } from "@/lib/lang";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="app-backdrop flex min-h-dvh flex-col items-center justify-center px-6 text-center text-ink">
      <Logo className="size-12" />
      <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.02em]">{t("nf.title")}</h1>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-ink-2">{t("nf.body")}</p>
      <LinkButton href="/" className="mt-7">
        {t("nf.home")}
      </LinkButton>
    </main>
  );
}
