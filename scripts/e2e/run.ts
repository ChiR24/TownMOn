// End-to-end run of the main flows in a real browser, against the running app, as each role.
//   npm run db:seed && npm run dev     (fresh demo data: the run pays bills, raises complaints, imports a statement)
//   npm run e2e                        (in another terminal; uses Chrome, Edge or Brave as installed, or BROWSER_PATH)
// Reseed afterwards to get the demo data back. Failure screenshots go to the system temp folder.
import { launch, report } from "./kit";
import { accountsFlows, privacyChecks } from "./money";
import { residentFlows, signInChecks } from "./resident";
import { deskFlows, gateFlows } from "./staff";

async function main() {
  const browser = await launch();
  await signInChecks(browser);
  const { swati, complaint, guestCode, receipt } = await residentFlows(browser);
  const neeraj = await gateFlows(browser, swati, guestCode);
  await deskFlows(browser, swati, complaint);
  await accountsFlows(browser);
  await privacyChecks(browser, neeraj, swati, complaint, receipt);
  await browser.close();
  return report();
}

main().then(
  (failed) => process.exit(failed ? 1 : 0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
