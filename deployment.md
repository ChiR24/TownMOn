# Deployment

## 1. Run it locally

You need Node.js 22 or newer and npm. Nothing else: the database is Postgres, run embedded (PGlite) on your
machine, so there is no database server to install.

```bash
git clone https://github.com/ChiR24/TownMOn.git
cd TownMOn
npm install
npm run dev
```

1. `npm run dev` first creates an embedded Postgres (PGlite) in `.data/`, applies the migrations and seeds a
   realistic township (2,400 flats, four months of bills and payments, complaints, visitors, bookings). This takes
   about 5 seconds, once.
2. Open http://localhost:3000 and sign in with a demo account (section 4). In demo mode the one-time code appears
   on screen; tap **Use**.
3. Optional: copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY` to turn on AI complaint triage.
   Without a key, complaints are classified by the keyword rules and marked "AI unavailable". With one,
   `npm run ai:check` tests the triage against the live API (23 complaints, about $0.006).
4. To start again from fresh data: stop `npm run dev`, then `npm run db:seed`.

Tests: `npm test` (each test file gets its own in-memory Postgres; nothing touches `.data/`). End to end:
`npm run db:seed`, then `npm run dev`, then `npm run e2e` in a second terminal. It drives Chrome, Edge or Brave
(whichever is installed, or the browser at `BROWSER_PATH`) through every main flow and changes the demo data, so run
`npm run db:seed` again afterwards.

### With your own Postgres instead

```bash
docker run -d --name township-db -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:17
# PowerShell: $env:DATABASE_URL="postgres://postgres:dev@localhost:5432/postgres"
export DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
npm run db:seed      # migrates and seeds
npm run dev
```

## 2. How it is deployed

It is not deployed yet; these are the steps for the setup it is built for. Vercel (Next.js, functions
in Mumbai `bom1`, set in `vercel.json`) and Postgres in Mumbai (Supabase `ap-south-1` or Neon). Both have free tiers.

1. **Database.** Create a Supabase project in South Asia (Mumbai). Copy the *transaction pooler* connection
   string (port 6543); that is `DATABASE_URL`.
2. **Schema and demo data.** From your machine, with `DATABASE_URL` set to that string:
   `npm run db:seed` (or `npm run db:migrate` for the schema alone).
3. **App.** Import the GitHub repository in Vercel (framework: Next.js; defaults are right). Add the environment
   variables below, then deploy.
4. **Daily job.** `vercel.json` schedules `GET /api/cron/daily` at 06:00 IST. It raises the month's bills on the
   1st (safe to run every day) and deletes visitor photos older than 90 days. Vercel sends `CRON_SECRET` as a
   bearer token; the route refuses anything else.
5. **Check.** Open the site, sign in as the accounts demo user, download the sample statement and import it.

Later schema changes: `npm run db:generate`, commit the new file in `drizzle/`, then `npm run db:migrate` against
the production database before deploying the code that needs it.

## 3. Environment variables (names only)

| Name | Required | What it is |
|---|---|---|
| `DATABASE_URL` | Production | Postgres connection string. Unset locally = embedded Postgres in `.data/` |
| `APP_SECRET` | Production | Long random string. Keys the hashes of one-time codes and guest codes |
| `GATEWAY_SECRET` | Production | Shared secret that signs the mock payment gateway's callbacks |
| `CRON_SECRET` | Production | Bearer token for `/api/cron/daily` |
| `ANTHROPIC_API_KEY` | Optional | Claude API key for complaint triage. Without it the keyword rules decide |
| `ANTHROPIC_MODEL` | Optional | Claude model for triage (default `claude-haiku-5-5`) |
| `DEMO_MODE` | Optional | `true` shows the one-time code on screen, the demo accounts and the sample statement. Default: on locally, off in production. Set `true` for the demo deployment |

Generate secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
Never commit them: `.env*` is git-ignored except `.env.example`, which holds names only.

## 4. Demo login details

Sign in with the mobile number; with `DEMO_MODE=true` the 6-digit code is shown on screen (no SMS is sent).
The sign-in page lists these accounts, so a tap is enough.

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

What is mocked: the payment gateway (TestPay, test mode, signed callbacks), SMS and WhatsApp
(stored as messages; a resident sees them under More → Messages), and the bank (CSV upload; the accounts page can
generate a realistic statement for today).
