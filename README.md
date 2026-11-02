# Township

Maintenance billing, payments that match themselves, complaints with AI triage, an offline gate tablet,
amenity booking and a committee dashboard, for a gated township of 2,400 flats in 28 towers (Pune).

Design notes: [docs/TDD.md](docs/TDD.md).
How to run and deploy: [deployment.md](deployment.md).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. No database to install: without `DATABASE_URL` the app uses an embedded Postgres
(PGlite) in `.data/`, created and seeded on first run. Sign in with any demo account on the sign-in page; in demo
mode the one-time code is shown on screen instead of being sent by SMS.

| Who | Mobile | Try |
|---|---|---|
| Neeraj Kulkarni, resident (T07-1203) | 9800000001 | All paid; a delivery waiting at the gate; guest codes |
| Swati Joshi, tenant (T12-0408) | 9800000002 | ₹19,337 overdue (about 47 days); pay it; her water-leak complaint |
| Aamir Shaikh, resident (T21-1601) | 9800000003 | Paid ₹5,000 of ₹10,660; 18 days overdue |
| Rohan Patil, help desk | 9800000010 | Complaints queue, the T14 lift reported by 10 flats, a gas-smell emergency |
| Sunita Deshmukh, accounts | 9800000011 | Download the sample statement, import it, work the review queue |
| Col. Vijay Rao, committee | 9800000012 | Dashboard and the monthly report |
| Anil Jadhav, duty manager | 9800000013 | Every staff area |
| Ramesh Pawar, guard | 9800000014 | Gate tablet (open on a tablet or phone) |

## Scripts

| | |
|---|---|
| `npm run dev` | Run locally (seeds the embedded database on first run) |
| `npm test` | 80+ tests: billing and interest, bank matching, OTP, payments, triage, gate, reports |
| `npm run ai:check` | The AI triage against the live Claude API: 23 complaints, about $0.006 (needs `ANTHROPIC_API_KEY`) |
| `npm run lint` / `npm run typecheck` | ESLint, TypeScript |
| `npm run db:seed` | Reset and reseed (stop `npm run dev` first when using the embedded database) |
| `npm run db:generate` | New SQL migration after a schema change |

## Where things are

```
src/app/(resident)   resident app: home, bills, pay, complaints, visitors, amenities, more
src/app/(staff)      help desk (/desk), accounts (/accounts), committee (/committee)
src/app/gate         guard tablet (offline-capable), gate notice
src/app/api          gateway callback, gate API, photos, daily cron
src/lib              the logic, framework-free and tested: billing, bank, triage, gate, metrics, ...
src/db               schema, migrations runner, seed
drizzle/             SQL migrations
```
