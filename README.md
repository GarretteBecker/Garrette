# B&M HomeKeeper

Managed-home membership platform for **B&M Home Improvement Solutions LLC**
(veteran-owned remodeler, Columbia PA, PA Lic. #154223).

> One number for your home.

## Quick start

```bash
npm install
cp .env.example .env.local   # then paste in your two Supabase values
npm run dev
```

Full setup, including creating the Supabase project and running the database
scripts: **[docs/supabase-setup.md](docs/supabase-setup.md)**

In a hurry? Paste **`supabase/SETUP-EVERYTHING.sql`** into the Supabase SQL
editor — it builds the whole database in one go.

## Demo logins

After running `supabase/seed.sql`:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@bmhomekeeper.test` | `HomeKeeper!2026` |
| Tech | `tech@bmhomekeeper.test` | `HomeKeeper!2026` |
| Member | `member@bmhomekeeper.test` | `HomeKeeper!2026` |

Demo only. Delete these before any real customer data goes in.

## How it's laid out

```
app/
  login/              Sign in
  admin/              Office: properties, Home Record, trade partners, reports
  field/              Technician: today's visits, checklist, finding capture
  home/               Homeowner portal: dashboard, record, plan, reports, docs
  demo/               The same portal on fixture data — no login, for sales
  reports/[id]/       The branded report (screen + print)
  api/scan-plate/     Reads a data plate off a photo (staff only)
  admin/requests/     The request board and lifecycle controls
  home/requests/      Member: raise a request and follow it
components/
  admin/  capture/  field/  member/  reports/
lib/
  supabase/           Browser, server and proxy clients — anon key only
  offline/            IndexedDB outbox + sync engine for the field app
  actions/            Server actions
  scan/               Data-plate schema + extraction prompt
  ghl/                GoHighLevel event payloads and dispatcher
  service-requests.ts The twelve stages, categories and urgency
  member/             Portal view model, loader, and demo fixture data
  checklist-templates.ts   Q1–Q4 seasonal checklists  ⚠ see ASSUMPTIONS
  types/              Schema types, status colors
supabase/
  migrations/         0001 schema · 0002 RLS · 0003 storage · 0004 reports
  seed.sql            The Miller Home demo
docs/
  supabase-setup.md   Step-by-step connection guide
  deploy-vercel.md    GitHub → Vercel → custom domain → phone install
  gohighlevel.md      Webhooks, payloads, and the API key
  ASSUMPTIONS.md      Everything invented in the spec's absence ⚠ review this
```

## Showing it to a prospect

`/demo` renders the homeowner portal from fixture data — no login, no
database, nothing real. It uses the same components the live portal uses, so
it cannot drift from what a member actually sees. Every screen is marked
"Sample home".

To remove it: delete `app/demo/`, `lib/member/demo-data.ts`,
`components/member/demo-banner.tsx`, and the `'/demo'` entry in
`PUBLIC_PATHS` in `lib/supabase/proxy.ts`.

## Data-plate scanning

Point the camera at the placard on a piece of equipment and it reads the
make, model and serial into the Home Record.

It is **optional**: set `ANTHROPIC_API_KEY` in `.env.local` to turn it on.
Without a key the camera still captures and stores photos normally, and the
app tells you to type the numbers in by hand.

Three rules the implementation holds to:

- **A scan is a claim, not a fact.** The reading is stored against the photo
  and shown for review; it reaches the Home Record only when a human accepts
  it, and by default it fills blanks only.
- **A blank beats a guess.** The prompt tells the model to return null
  rather than guess at a character — a wrong serial fails a warranty claim
  years later and nobody notices until then.
- **Text in a photo is data, never an instruction.** The prompt says so
  explicitly, and a human reviews every reading before it is saved.

## Going live

`docs/deploy-vercel.md` walks through GitHub, Vercel, a custom domain, and
installing it on a phone. `docs/gohighlevel.md` covers the GHL webhooks.

## Security

`SECURITY-REVIEW.md` records a full audit: what was tested, what was not, the
findings (one critical, fixed), and twelve items to verify before real
customer data. **Start with disabling public signup in Supabase.**

## Security model

Every table has Row Level Security on, forced, deny-by-default. A member can
only ever read rows for a property they are linked to — that's enforced by
Postgres, not by the screens. There is deliberately **no service-role client
anywhere in this codebase**: all queries run as the signed-in user, so nothing
can read across properties just because it happens to run on a server.

Per `CLAUDE.md` rule 3, there is no field anywhere in the schema for alarm
codes, passwords, safe combinations, or payment card data.

## Scripts

```bash
npm run dev         # local dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

---

B&M Home Improvement Solutions LLC • PA Lic. #154223
