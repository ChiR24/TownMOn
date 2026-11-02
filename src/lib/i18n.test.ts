import { expect, it } from "vitest";
import { GATE_TEXT } from "../app/gate/strings";
import { translator } from "./i18n";
import { en } from "./i18n/en";
import { hi } from "./i18n/hi";
import { mr } from "./i18n/mr";

it("fills placeholders, with English singulars", () => {
  const en = translator("en");
  expect(en("home.overdue", { days: 48 })).toBe("48 days overdue");
  expect(en("home.overdue", { days: 1 })).toBe("1 day overdue");
  expect(en("home.overdue", { days: 21 })).toBe("21 days overdue");
  expect(translator("mr")("home.overdue", { days: 1 })).toBe("1 दिवस थकीत");
});

// Every Marathi and Hindi string, in the app and on the gate tablet, next to its English original.
const pairs = [
  ...(["mr", "hi"] as const).flatMap((lang) => Object.keys(en).map((k) => ({ where: `${lang} ${k}`, en: en[k as keyof typeof en], text: (lang === "mr" ? mr : hi)[k as keyof typeof en] }))),
  ...(["mr", "hi"] as const).flatMap((lang) => Object.entries(GATE_TEXT.en).map(([k, v]) => ({ where: `gate ${lang} ${k}`, en: v as string, text: GATE_TEXT[lang][k as keyof typeof GATE_TEXT.en] as string }))),
];
const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

it("Marathi and Hindi keep exactly the English placeholders, so no screen shows a raw {name}", () => {
  expect(pairs.length).toBeGreaterThan(500); // every string of both languages, not an empty list that passes by default
  for (const p of pairs) expect(`${p.where}: ${slots(p.text)}`).toBe(`${p.where}: ${slots(p.en)}`);
});

it("every Marathi and Hindi string is written in Devanagari, none left in English", () => {
  for (const p of pairs) expect(`${p.where}: ${/\p{Script=Devanagari}/u.test(p.text)}`).toBe(`${p.where}: true`);
});
