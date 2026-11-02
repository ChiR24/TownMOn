// Shared pieces of the end-to-end run: the browser, sign-in, and the check and report helpers.
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContextOptions, type Locator, type Page } from "playwright-core";

export const base = process.env.E2E_URL ?? "http://localhost:3000";
export const phone: BrowserContextOptions = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
export const desktop: BrowserContextOptions = { viewport: { width: 1366, height: 900 } };
export const tablet: BrowserContextOptions = { viewport: { width: 1180, height: 820 }, hasTouch: true };
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

/**
 * A phone-camera photo: 4000x3000 JPEG, megabytes like a real one, red on top and blue below as stored, with the
 * EXIF tag phones write for a portrait shot ("turn 90° clockwise to view"). Kept upright, red ends up on the right.
 */
export async function cameraPhoto(page: Page) {
  const b64 = await page.evaluate(async () => {
    const [w, h] = [4000, 3000];
    const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(w, h);
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      const n = (Math.random() * 24) | 0; // sensor noise, so the file is camera-sized
      const top = p < (w * h) / 2;
      img.data[i] = top ? 220 + n : n;
      img.data[i + 1] = n;
      img.data[i + 2] = top ? n : 220 + n;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const bytes = new Uint8Array(await (await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.92))).arrayBuffer());
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const jpeg = Buffer.from(b64, "base64");
  // APP1 "Exif" segment: big-endian TIFF header, then IFD0 with one entry: Orientation (0x0112), SHORT x1, value 6.
  const exif = Buffer.from("ffe10022457869660000" + "4d4d002a00000008" + "0001" + "0112000300000001" + "00060000" + "00000000", "hex");
  return { name: "IMG_20261102_093012.jpg", mimeType: "image/jpeg", buffer: Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]) };
}

/** The stored photo as the app serves it: its size, and whether it is upright (the red half on the right). */
export async function storedPhoto(page: Page, id: string | number) {
  return page.evaluate(async (src) => {
    const blob = await (await fetch(src)).blob();
    const bmp = await createImageBitmap(blob);
    const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    // No named functions in here: tsx wraps them in a __name() helper that the page doesn't have.
    const [right, left] = [0.9, 0.1].map((f) => ctx.getImageData(Math.floor(bmp.width * f), Math.floor(bmp.height / 2), 1, 1).data);
    return { width: bmp.width, height: bmp.height, kb: Math.round(blob.size / 1024), upright: right[0] > right[2] && left[0] < left[2] };
  }, `/api/photos/${id}`);
}

/** True when the page is the app's not-found page (another flat's data is a 404). */
export async function isNotFound(page: Page, status: number) {
  return status >= 400 || /doesn't exist|not found/i.test(await page.locator("body").innerText());
}
