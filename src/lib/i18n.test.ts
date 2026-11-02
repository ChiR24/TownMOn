import { expect, it } from "vitest";
import { translator } from "./i18n";

it("fills placeholders, with English singulars", () => {
  const en = translator("en");
  expect(en("home.overdue", { days: 48 })).toBe("48 days overdue");
  expect(en("home.overdue", { days: 1 })).toBe("1 day overdue");
  expect(en("home.overdue", { days: 21 })).toBe("21 days overdue");
  expect(translator("mr")("home.overdue", { days: 1 })).toBe("1 दिवस थकीत");
});
