// Shared pieces of the end-to-end run: the browser, sign-in, and the check and report helpers.
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContextOptions, type Locator, type Page } from "playwright-core";
import { placeholderPhoto } from "../../src/db/seed/kit";

export const base = process.env.E2E_URL ?? "http://localhost:3000";
export const phone: BrowserContextOptions = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
export const desktop: BrowserContextOptions = { viewport: { width: 1366, height: 900 } };
export const tablet: BrowserContextOptions = { viewport: { width: 1180, height: 820 }, hasTouch: true };
export const photo = { name: "photo.png", mimeType: "image/png", buffer: placeholderPhoto(256) };
const shots = join(tmpdir(), "township-e2e");

const BRAVE = [`${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`, "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", "/usr/bin/brave-browser"];

/** Any Chromium-based browser already on the machine: BROWSER_PATH, else Chrome, Edge or Brave. Nothing is downloaded. */
export async function launch(): Promise<Browser> {
  const brave = BRAVE.find((p) => existsSync(p));
  const tries = [process.env.BROWSER_PATH && { executablePath: process.env.BROWSER_PATH }, { channel: "chrome" }, { channel: "msedge" }, brave && { executablePath: brave }];
  for (const opts of tries) if (opts) try {
    return await chromium.launch({ ...opts, headless: true });
  } catch {}
  throw new Error("No Chrome, Edge or Brave found. Install one, or set BROWSER_PATH to a Chromium-based browser.");
}

const results: string[] = [];

/** Runs one check; a failure is recorded (with a screenshot) and the run goes on. */
export async function check(name: string, page: Page | null, fn: () => Promise<unknown>) {
  const t0 = Date.now();
  try {
    await fn();
    results.push(`ok    ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    mkdirSync(shots, { recursive: true });
    const file = join(shots, `fail-${results.length + 1}.png`);
    await page?.screenshot({ path: file }).catch(() => {});
    const where = page ? new URL(page.url()).pathname : "-";
    results.push(`FAIL  ${name}: ${String((e as Error).message).split("\n")[0].slice(0, 200)} (at ${where}${page ? `; ${file}` : ""})`);
  }
  console.log(results.at(-1));
}

export function report() {
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  return failed;
}

export const see = (page: Page, text: string, timeout = 15_000) => page.getByText(text, { exact: false }).first().waitFor({ timeout });
export const settle = (page: Page) => page.waitForLoadState("networkidle");
export const go = (page: Page, path: string) => page.goto(base + path, { waitUntil: "networkidle" });

/** Clicks a server-action button and waits for its POST to come back, not just for the page to look idle. */
export async function submit(page: Page, button: Locator) {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().startsWith(base), { timeout: 30_000 }), button.click()]);
  await settle(page);
}

/** Signs in through the demo list, as someone trying the demo would. One code per role: a number may ask for 3 in 10 minutes. */
export async function signIn(browser: Browser, device: BrowserContextOptions, name: string) {
  const page = await (await browser.newContext({ ...device, reducedMotion: "reduce" })).newPage();
  await go(page, "/login");
  await page.locator(`button[aria-label^="${name}"]`).click();
  await page.getByRole("button", { name: "Use", exact: true }).click();
  await page.locator('button[name="intent"][value="verify"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  if (new URL(page.url()).pathname.startsWith("/welcome")) {
    await page.getByRole("button", { name: "I agree, continue" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/welcome"), { timeout: 30_000 });
  }
  await settle(page);
  return page;
}

/** True when the page is the app's not-found page (another flat's data is a 404). */
export async function isNotFound(page: Page, status: number) {
  return status >= 400 || /doesn't exist|not found/i.test(await page.locator("body").innerText());
}
