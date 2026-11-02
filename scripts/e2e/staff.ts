// End to end, part 2: the gate tablet, residents answering it, and the help desk working complaints.
import type { Browser, Page } from "playwright-core";
import { base, check, desktop, go, phone, photo, see, signIn, submit, tablet } from "./kit";

export async function gateFlows(browser: Browser, swati: Page, guestCode: string) {
  const gate = await signIn(browser, tablet, "Ramesh Pawar");
  async function typeCode(code: string) {
    await go(gate, "/gate");
    await gate.getByRole("button", { name: "Guest code" }).click();
    for (const d of code) await gate.getByRole("button", { name: d, exact: true }).click();
    await gate.getByRole("button", { name: "Check code" }).click();
  }
  async function newVisitor(flat: string, name: string, withPhoto = false) {
    await go(gate, "/gate");
    await gate.getByRole("button", { name: "New visitor" }).click();
    if (withPhoto) await gate.locator('input[type="file"]').setInputFiles(photo);
    await gate.locator("#flat").fill(flat);
    await gate.locator("#vname").fill(name);
    await gate.getByRole("button", { name: "Guest", exact: true }).click();
    await gate.getByRole("button", { name: "Ask resident" }).click();
  }

  await check("gate: the resident's guest code lets the guest in", gate, async () => {
    await typeCode(guestCode);
    await see(gate, "Valid code: Ravi Kumar");
  });
  await check("gate: the same code again is refused as used", gate, async () => {
    await typeCode(guestCode);
    await see(gate, "already been used");
  });
  await check("gate: a wrong code is refused", gate, async () => {
    await typeCode("000000");
    await see(gate, "Code not valid");
  });
  await check("gate: a new visitor, with photo, is sent to the flat's residents", gate, async () => {
    await newVisitor("T12-0408", "Test Visitor", true);
    await see(gate, "Test Visitor");
  });
  await check("resident: approves from home; the guard sees it and lets the visitor in", swati, async () => {
    await go(swati, "/");
    await see(swati, "Test Visitor is at Gate");
    await submit(swati, swati.getByRole("button", { name: "Let in" }).first());
    await go(gate, "/gate");
    await see(gate, "Resident approved");
    await gate.getByRole("button", { name: "Let in", exact: true }).click();
    await gate.locator('button[aria-label="Left: Test Visitor"]').waitFor({ timeout: 20_000 });
  });
  await check("gate: marking the visitor as left", gate, async () => {
    await gate.locator('button[aria-label="Left: Test Visitor"]').click();
    await gate.locator('button[aria-label="Left: Test Visitor"]').waitFor({ state: "detached", timeout: 15_000 });
  });
  await check("gate: after 2 minutes unanswered, the guard settles it on the intercom", gate, async () => {
    await go(gate, "/gate");
    await see(gate, "Imran (Swiggy)");
    await gate.getByRole("button", { name: "Approved on call" }).first().click();
    await gate.locator('button[aria-label="Left: Imran (Swiggy)"]').waitFor({ timeout: 15_000 });
  });
  await check("gate: offline, an entry is kept on the tablet and synced when back online", gate, async () => {
    await go(gate, "/gate");
    await gate.context().setOffline(true);
    await gate.getByRole("button", { name: "New visitor" }).click();
    await gate.locator("#flat").fill("T07-1203");
    await gate.locator("#vname").fill("Offline Guest");
    await gate.getByRole("button", { name: "Ask resident" }).click();
    await see(gate, "to sync");
    await gate.context().setOffline(false);
    await gate.getByText("to sync").first().waitFor({ state: "detached", timeout: 30_000 });
    await go(gate, "/gate");
    await see(gate, "Offline Guest");
  });

  const neeraj = await signIn(browser, phone, "Neeraj Kulkarni");
  await check("resident: denies a visitor; the tablet records it", neeraj, async () => {
    await newVisitor("T07-1203", "Unknown Caller");
    await see(gate, "Unknown Caller");
    await go(neeraj, "/");
    await see(neeraj, "Unknown Caller is at Gate");
    await submit(neeraj, neeraj.getByRole("button", { name: "Deny" }).first());
    const feed = await (await gate.request.get(`${base}/api/gate/feed?gate=1`)).json();
    const entry = feed.entries.find((e: { name: string }) => e.name === "Unknown Caller");
    if (entry?.status !== "DENIED") throw new Error(`the gate feed says ${entry?.status}`);
  });
  return neeraj;
}

export async function deskFlows(browser: Browser, swati: Page, complaint: string) {
  const desk = await signIn(browser, desktop, "Rohan Patil");
  const open = async (text: string) => {
    await desk.locator("a").filter({ hasText: text }).first().click();
    await desk.waitForURL(/\/desk\/complaints\/\d+/);
    return new URL(desk.url()).pathname.split("/").pop()!;
  };

  await check("desk: a note, then work started, then fixed, on the resident's new complaint", desk, async () => {
    await go(desk, `/desk/complaints/${complaint}`);
    await desk.locator("#note").fill("Plumber will come at 4 pm");
    await submit(desk, desk.getByRole("button", { name: "Note", exact: true }));
    await see(desk, "Plumber will come at 4 pm");
    await submit(desk, desk.getByRole("button", { name: "Start work" }));
    await desk.waitForFunction(() => document.querySelector<HTMLButtonElement>('button[value="start"]')?.disabled, null, { timeout: 10_000 });
    await submit(desk, desk.getByRole("button", { name: "Fixed", exact: true }));
    await desk.locator("#note").waitFor({ state: "detached", timeout: 10_000 }); // a fixed complaint takes no more updates
  });
  await check("desk: a one-tap category fix on an unsure AI call is logged with what the AI said", desk, async () => {
    await go(desk, "/desk?view=triage");
    await desk.locator('a[href^="/desk/complaints/"]').first().click();
    await desk.waitForURL(/\/desk\/complaints\/\d+/);
    await submit(desk, desk.getByRole("button", { name: "Water supply", exact: true }));
    await see(desk, "(AI said Other");
  });
  await check("desk: urgency and technician", desk, async () => {
    await desk.locator('select[name="urgency"]').selectOption("HIGH");
    await submit(desk, desk.getByRole("button", { name: "Save", exact: true }));
    await see(desk, "Urgency set to high");
    const options = await desk.locator('select[name="techId"] option').allInnerTexts();
    const pick = options.findIndex((o, i) => i > 0 && o.includes("✓"));
    await desk.locator('select[name="techId"]').selectOption({ index: pick });
    await submit(desk, desk.getByRole("button", { name: "Assign", exact: true }));
    await see(desk, `Assigned to ${options[pick].replace("✓", "").trim()}`);
  });
  await check("desk: unlinking one duplicate from the T14 lift", desk, async () => {
    await go(desk, "/desk");
    await open("Lift A in T14 not working");
    const unlink = desk.locator('button[aria-label^="Unlink #"]');
    await unlink.first().waitFor();
    const before = await unlink.count();
    await submit(desk, unlink.first());
    await desk.reload({ waitUntil: "networkidle" });
    if ((await unlink.count()) !== before - 1) throw new Error(`linked ${before} -> ${await unlink.count()}`);
  });
  await check("desk: a notice for tower 12 reaches the resident's home", desk, async () => {
    await go(desk, "/desk/notices");
    await desk.locator('input[name="title"]').fill("Tank cleaning in T12 on Friday");
    await desk.locator('textarea[name="body"]').fill("Water will be off from 10 am to 1 pm. Please store water the night before.");
    await desk.locator('select[name="tower"]').selectOption("12");
    await submit(desk, desk.getByRole("button", { name: "Post notice" }));
    await go(swati, "/");
    await see(swati, "Tank cleaning in T12 on Friday");
  });
  await check("resident: rates the fixed complaint and closes it", swati, async () => {
    await go(swati, `/complaints/${complaint}`);
    await swati.locator('input[name="rating"][value="4"]').check({ force: true });
    await swati.locator('textarea[name="comment"]').fill("Quick and tidy.");
    await submit(swati, swati.getByRole("button", { name: "Close complaint" }));
    await see(swati, "You rated this 4/5");
  });
  await check("resident: 'still a problem' reopens it with a fresh response clock", swati, async () => {
    await go(desk, "/desk");
    const id = await open("Bathroom ceiling leak");
    await submit(desk, desk.getByRole("button", { name: "Fixed", exact: true }));
    await go(swati, `/complaints/${id}`);
    await submit(swati, swati.getByRole("button", { name: "No, still a problem" }));
    await see(swati, "Resident says it is not fixed");
    await see(swati, "Response by");
  });
}
