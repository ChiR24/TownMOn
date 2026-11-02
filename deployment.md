# Deployment

## 1. Run it locally

You need Node.js 22 or newer. The database is Postgres, run embedded (PGlite), so there is nothing else to install.

1. `git clone https://github.com/ChiR24/TownMOn.git`, then `cd TownMOn`
2. `npm install`
3. `npm run dev`. The first run creates the database in `.data/` and loads the demo data (about 5 seconds).
4. Open http://localhost:3000 and sign in with a demo account (section 3). The one-time code appears on screen; tap
   **Use**.

To see the AI complaint triage locally, copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. Without
it, complaints are sorted by the keyword rules and marked "AI unavailable". `npm run db:seed` resets the demo data
(stop `npm run dev` first).

## 2. How it is deployed

- **App:** Vercel (Next.js), functions in Singapore (`sin1`, set in `vercel.json`).
- **Database:** Postgres on Neon in Singapore, connected through Vercel's Neon integration, which provides
  `DATABASE_URL`. Neon's free tier has no Mumbai region; the township's own deployment would be in Mumbai (TDD, A16).
  The schema and demo data were loaded with `npm run db:seed`.
- **Daily job:** Vercel Cron calls `/api/cron/daily` at 06:00 IST (`vercel.json`), with `CRON_SECRET` as a bearer
  token. It raises the month's bills on the 1st and deletes visitor photos older than 90 days.
- **No AI key on the live app,** so complaints there are sorted by the keyword rules. AI triage runs wherever
  `ANTHROPIC_API_KEY` is set (section 1).
- **Installs like an app:** Android, Chrome menu → Install app; iPhone, Safari → Share → Add to Home Screen; a computer,
  the install icon in Chrome, Edge or Brave's address bar.

Environment variables (names only):

| Name | On the live app | What it is |
|---|---|---|
| `DATABASE_URL` | From the Neon integration | Postgres connection string. Unset locally = embedded Postgres in `.data/` |
| `APP_SECRET` | Set | Keys the hashes of one-time codes and guest codes |
| `GATEWAY_SECRET` | Set | Signs the mock payment gateway's callbacks |
| `CRON_SECRET` | Set | Bearer token for `/api/cron/daily` |
| `DEMO_MODE` | `true` | Shows the one-time code on screen, the demo accounts and the sample bank statement |
| `ANTHROPIC_API_KEY` | Not set | Claude API key for complaint triage |
| `ANTHROPIC_MODEL` | Not set | Claude model for triage (default `claude-haiku-5-5`) |

## 3. Demo logins

Sign in with the mobile number. The 6-digit code is shown on screen (no SMS is sent), and the sign-in page lists these
accounts, so a tap is enough. Each account opens its own role's screens; to try another role, sign out (residents:
More → Sign out; staff: the sidebar; guard: the gate footer) and tap the next one. There is no sign-up, by design:
accounts come from the federation's register of flats (TDD, A22), and residents add family under More → Household.

| Role | Name | Mobile | What to look at |
|---|---|---|---|
| Resident (owner) | Neeraj Kulkarni, T07-1203 | 9800000001 | All paid. A Swiggy delivery is waiting at Gate 1: approve it. Make a guest code |
| Resident (tenant) | Swati Joshi, T12-0408 | 9800000002 | ₹19,337 overdue with interest. Pay it in test mode and get a receipt. Her water-leak complaint |
| Resident (owner) | Aamir Shaikh, T21-1601 | 9800000003 | Part paid (₹5,000 of ₹10,660), 18 days overdue |
| Help desk | Rohan Patil | 9800000010 | Queue, the T14 lift reported by 10 flats (one fix updates all), a gas-smell emergency, one-tap category fix |
| Accounts | Sunita Deshmukh | 9800000011 | Download the sample statement, import it, then the review queue |
| Committee | Col. Vijay Rao | 9800000012 | Dashboard; monthly report (prints to PDF) |
| Duty manager | Anil Jadhav | 9800000013 | All staff areas |
| Guard | Ramesh Pawar | 9800000014 | `/gate`: new visitor, guest code 315760 (Neeraj's niece), intercom fallback |

A number can ask for 3 codes in 10 minutes. What is mocked: the payment gateway (TestPay, test
mode, signed callbacks), SMS and WhatsApp (stored as messages; a resident sees them under More → Messages), and the
bank (CSV upload; the accounts page can generate a realistic statement for today).
