import { cookies } from "next/headers";
import { isLang, translator, type Lang } from "./i18n";

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("lang")?.value;
  return isLang(c) ? c : "en";
}

export async function getT() {
  return translator(await getLang());
}
