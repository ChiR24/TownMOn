// End to end, part 1: sign-in, and a resident's day (Swati, the overdue tenant in T12-0408).
import type { Browser } from "playwright-core";
import { cameraPhoto, check, go, phone, see, settle, signIn, storedPhoto, submit } from "./kit";

export async function signInChecks(browser: Browser) {
  const page = await (await browser.newContext(phone)).newPage();
  await check("sign-in: a short number is refused", page, async () => {
    await go(page, "/login");
    await page.locator("#phone").fill("12345");
    await page.getByRole("button", { name: "Send code" }).click();
    await see(page, "Enter a 10-digit mobile number");
  });
  await check("sign-in: a wrong code is refused, and the number can be changed", page, async () => {
    await go(page, "/login");
    await page.locator("#phone").fill("9800000003"); // Aamir: the others keep their code quota for their own sign-ins
    await page.getByRole("button", { name: "Send code" }).click();
    await page.locator("#code").fill("000000");
    await page.locator('button[name="intent"][value="verify"]').click();
    await see(page, "That code is not right");
    await page.getByRole("button", { name: "Change number" }).click();
    await page.locator("#phone").waitFor();
  });
  await check("sign-in: an unknown number gets the same answer (no account check) but no code", page, async () => {
    await go(page, "/login");
    await page.locator("#phone").fill("9811111111");
    await page.getByRole("button", { name: "Send code" }).click();
    await page.locator("#code").waitFor();
    if (await page.getByText("Demo SMS").count()) throw new Error("a code was shown for an unknown number");
  });
}

export async function residentFlows(browser: Browser) {
  const swati = await signIn(browser, phone, "Swati Joshi");
  const out = { swati, complaint: "", guestCode: "", receipt: "" };

  await check("home: dues, days overdue and the pay button", swati, async () => {
    await see(swati, "19,337");
    await see(swati, "days overdue");
  });
  await check("bills: the breakdown with interest, and the history", swati, async () => {
    await go(swati, "/bills");
    await see(swati, "Interest on overdue maintenance");
    await see(swati, "History");
  });
  await check("pay: a failed test payment says no money was taken", swati, async () => {
    await go(swati, "/bills/pay");
    await swati.getByRole("button", { name: "Continue to payment" }).click();
    await swati.waitForURL(/\/pay\//);
    await swati.locator('button[name="outcome"][value="fail"]').click();
    await swati.waitForURL(/failed=1/);
    await see(swati, "didn't go through");
  });
  await check("pay: a successful test payment gives a receipt, and home says all paid", swati, async () => {
    await go(swati, "/bills/pay");
    await swati.getByRole("button", { name: "Continue to payment" }).click();
    await swati.waitForURL(/\/pay\//);
    await swati.locator('button[name="outcome"][value="ok"]').click();
    await swati.waitForURL(/\/receipts\//);
    out.receipt = new URL(swati.url()).pathname;
    await see(swati, "Payment received");
    await see(swati, "Rupees Nineteen Thousand Three Hundred Thirty-Seven only");
    await go(swati, "/");
    await see(swati, "All paid");
  });
  await check("pay: then nothing is due", swati, async () => {
    await go(swati, "/bills/pay");
    await see(swati, "Nothing is due right now");
  });

  await check("complaint: too short is refused and the text is kept", swati, async () => {
    await go(swati, "/complaints/new");
    await swati.locator("#description").fill("ab");
    await swati.getByRole("button", { name: "Send to help desk" }).click();
    if (!(await swati.locator("#description").evaluate((el: HTMLTextAreaElement) => el.validity.tooShort))) await see(swati, "Please describe the problem");
    if (!swati.url().endsWith("/complaints/new")) throw new Error("a too-short complaint was sent");
    if ((await swati.locator("#description").inputValue()) !== "ab") throw new Error("the typed text was lost");
  });
  await check("complaint: raised with a 12 MP phone photo; it is stored small and upright, and the rules answer at once", swati, async () => {
    await go(swati, "/complaints/new");
    await swati.locator("#description").fill("The kitchen sink tap has been leaking since yesterday evening and the cabinet below is wet.");
    await swati.locator('input[name="photo"]').setInputFiles(await cameraPhoto(swati));
    await swati.locator('img[src^="blob:"]').waitFor(); // the preview appears once the photo has been shrunk
    await swati.getByRole("button", { name: "Send to help desk" }).click();
    await swati.waitForURL(/\/complaints\/\d+\?new=1/, { timeout: 30_000 });
    out.complaint = new URL(swati.url()).pathname.split("/").pop()!;
    await see(swati, "Sent. The help desk will respond soon");
    const src = await swati.locator('img[src^="/api/photos/"]').getAttribute("src");
    const stored = await storedPhoto(swati, src!.split("/").pop()!);
    if (!(stored.upright && stored.width === 960 && stored.height === 1280 && stored.kb < 1024)) throw new Error(`stored photo: ${JSON.stringify(stored)}`);
    await see(swati, "Rules:");
  });
  await check("complaint: within 30 seconds Claude sorts it as plumbing (or, with no API key, says AI is unavailable)", swati, async () => {
    const done = () => swati.getByText(/AI: |AI unavailable/).count();
    for (let i = 0; i < 15 && !(await done()); i++) {
      await swati.waitForTimeout(2000);
      await go(swati, `/complaints/${out.complaint}`);
    }
    if (!(await swati.getByText("AI unavailable").count())) await see(swati, "AI: Plumbing", 1000);
  });

  await check("guest code: created and shown big", swati, async () => {
    await go(swati, "/visitors");
    await swati.locator("#guestName").fill("Ravi Kumar");
    await swati.getByRole("button", { name: "Create code" }).click();
    const ticket = swati.getByRole("status").filter({ hasText: "Code for Ravi Kumar" });
    await ticket.waitFor();
    out.guestCode = (await ticket.innerText()).match(/\b\d{6}\b/)?.[0] ?? "";
    if (!out.guestCode) throw new Error("no 6-digit code on the ticket");
  });
  await check("amenity: book a slot three days ahead, then cancel it", swati, async () => {
    await go(swati, "/amenities");
    const day = (await swati.locator('a[href*="d="]').nth(3).getAttribute("href"))?.match(/d=([\d-]+)/)?.[1];
    await swati.locator('a[href*="d="]').nth(3).click();
    await swati.waitForURL((u) => u.searchParams.get("d") === day);
    await swati.locator('a[href*="slot="]').first().click();
    await swati.waitForURL((u) => u.searchParams.has("slot"));
    await swati.getByRole("button", { name: /^Book for/ }).click();
    await see(swati, "Booked. Enjoy!");
    await swati.locator('button[aria-label^="Cancel booking:"]').first().click();
    await see(swati, "Booking cancelled");
  });
  await check("household: add a member, then remove them", swati, async () => {
    await go(swati, "/more");
    await swati.locator('input[name="name"]').fill("Test Member");
    await swati.locator('input[name="phone"]').fill("9812345678");
    await swati.getByRole("button", { name: "Add a family member" }).click();
    await see(swati, "Added. They can now sign in");
    await go(swati, "/more");
    await submit(swati, swati.locator("li").filter({ hasText: "Test Member" }).getByRole("button", { name: "Remove" }));
    await go(swati, "/more");
    if (await swati.getByText("Test Member").count()) throw new Error("the member is still listed");
  });
  await check("language: Marathi, then back to English", swati, async () => {
    await go(swati, "/more");
    await submit(swati, swati.getByRole("button", { name: "मराठी" }));
    await swati.waitForFunction(() => document.documentElement.lang.startsWith("mr"), null, { timeout: 10_000 });
    await go(swati, "/");
    await see(swati, "नमस्कार, Swati");
    await go(swati, "/more");
    await submit(swati, swati.getByRole("button", { name: "English" }));
    await swati.waitForFunction(() => document.documentElement.lang.startsWith("en"), null, { timeout: 10_000 });
    await go(swati, "/");
    await see(swati, "Hello, Swati");
  });
  await settle(swati);
  return out;
}
