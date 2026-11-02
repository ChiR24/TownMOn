// End to end, part 3: bank statement matching (the hard part), the committee, and who can see what.
import type { Browser, Page } from "playwright-core";
import { base, check, desktop, go, isNotFound, see, signIn, submit } from "./kit";

export async function accountsFlows(browser: Browser) {
  const acc = await signIn(browser, desktop, "Sunita Deshmukh");
  const statement = { name: "statement.csv", mimeType: "text/csv", buffer: await (await acc.request.get(`${base}/accounts/sample-statement`)).body() };
  const upload = async (file: { name: string; mimeType: string; buffer: Buffer }) => {
    await go(acc, "/accounts");
    await acc.locator('input[name="file"]').setInputFiles(file);
    await submit(acc, acc.getByRole("button", { name: "Import and match" }));
  };
  const waiting = async () => {
    await go(acc, "/accounts/review");
    return Number((await acc.getByText(/\d+ waiting/).first().innerText()).match(/\d+/)![0]);
  };

  await check("accounts: a file that is not a CSV statement is refused in words", acc, async () => {
    await upload({ name: "statement.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await see(acc, "Export the statement from net banking as CSV");
  });
  await check("accounts: the sample statement imports; some credits post themselves, some go to review", acc, async () => {
    await upload(statement);
    await acc.waitForURL(/\/accounts\/imports\/\d+/);
    await see(acc, "Posted itself");
    await see(acc, "Sent to review");
  });
  await check("accounts: importing the same file again posts nothing", acc, async () => {
    await upload(statement);
    await acc.waitForURL(/\/accounts\/imports\/\d+/);
    const posted = await acc.locator("p", { hasText: "Posted itself" }).locator("xpath=following-sibling::*[1]").innerText();
    if (posted.trim() !== "0") throw new Error(`the re-import posted ${posted}`);
  });
  const queueStep = (name: string, act: () => Promise<void>) =>
    check(name, acc, async () => {
      const before = await waiting();
      await act();
      if ((await waiting()) !== before - 1) throw new Error(`the queue went ${before} -> ${await waiting()}`);
    });
  await queueStep("review queue: post to a suggested flat", () => submit(acc, acc.getByRole("button", { name: /^Post to T\d\d-\d{4}$/ }).first()));
  await queueStep("review queue: post to a typed flat", async () => {
    await acc.locator('input[name="flatId"]').first().fill("T07-1203");
    await submit(acc, acc.getByRole("button", { name: "Post", exact: true }).first());
  });
  await queueStep("review queue: mark as not a resident payment", async () => {
    await acc.locator('select[name="reason"]').first().selectOption({ index: 0 });
    await submit(acc, acc.getByRole("button", { name: "Not a resident payment" }).first());
  });
  await check("accounts: find a flat, reverse a bank payment, and it goes back to the review queue", acc, async () => {
    const before = await waiting();
    await go(acc, "/accounts");
    await acc.locator('input[name="q"]').fill("T07-1203");
    await acc.locator('input[name="q"]').press("Enter");
    await acc.waitForURL(/\/accounts\/flats\/T07-1203/);
    await acc.locator("summary", { hasText: "Reverse" }).first().click();
    await acc.locator('details[open] input[name="reason"]').fill("Posted to the wrong flat in testing");
    await submit(acc, acc.locator("details[open] button").first());
    await see(acc, "Payment reversed");
    if ((await waiting()) !== before + 1) throw new Error("the reversed line did not return to the queue");
  });
  await check("accounts: the monthly bill run page opens", acc, async () => {
    await go(acc, "/accounts");
    await see(acc, "Monthly bills");
  });

  const rao = await signIn(browser, desktop, "Col. Vijay Rao");
  await check("committee: the dashboard, and a monthly report that reconciles", rao, async () => {
    await see(rao, "How the township is doing");
    await go(rao, "/committee/report");
    await see(rao, "Reconciles to the paisa");
  });
}

export async function privacyChecks(browser: Browser, other: Page, owner: Page, complaint: string, receipt: string) {
  await check("privacy: another flat's receipt is not shown", other, async () => {
    const res = await other.goto(base + receipt, { waitUntil: "networkidle" });
    if (!(await isNotFound(other, res?.status() ?? 200))) throw new Error("another flat's receipt opened");
  });
  await check("privacy: another flat's complaint is a 404", other, async () => {
    const res = await other.goto(`${base}/complaints/${complaint}`, { waitUntil: "networkidle" });
    if (!(await isNotFound(other, res?.status() ?? 200))) throw new Error("another flat's complaint opened");
  });
  await check("privacy: another flat's complaint photo is not served", other, async () => {
    await go(owner, `/complaints/${complaint}`);
    const src = await owner.locator('img[src^="/api/photos/"]').getAttribute("src");
    const res = await other.request.get(base + src);
    if (res.status() < 400) throw new Error(`HTTP ${res.status()} for another flat's photo`);
  });
  const anon = await browser.newContext();
  await check("security: the daily job refuses a call without its secret", null, async () => {
    const res = await anon.request.get(`${base}/api/cron/daily`);
    if (res.status() !== 401) throw new Error(`HTTP ${res.status()}`);
  });
  await check("security: nosniff, no framing, a strict referrer policy; camera and microphone for this site only", null, async () => {
    const h = (await anon.request.get(`${base}/login`)).headers();
    if (h["x-content-type-options"] !== "nosniff" || h["x-frame-options"] !== "DENY" || !h["referrer-policy"]) throw new Error(JSON.stringify(h).slice(0, 160));
    // Speaking a complaint needs the microphone: a policy of microphone=() would silently break the Speak button.
    if (!h["permissions-policy"]?.includes("microphone=(self)") || !h["permissions-policy"]?.includes("camera=(self)")) throw new Error(h["permissions-policy"]);
  });
  await check("security: signed out, every area sends you to sign in", null, async () => {
    const page = await anon.newPage();
    for (const path of ["/", "/bills", "/desk", "/accounts", "/committee", "/gate"]) {
      await page.goto(base + path, { waitUntil: "domcontentloaded" });
      if (!new URL(page.url()).pathname.startsWith("/login")) throw new Error(`${path} opened without signing in`);
    }
  });
}
