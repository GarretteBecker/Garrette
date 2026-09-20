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
components/
  admin/  field/  member/  reports/
lib/
  supabase/           Browser, server and proxy clients — anon key only
  offline/            IndexedDB outbox + sync engine for the field app
  actions/            Server actions
  member/             Portal view model, loader, and demo fixture data
  checklist-templates.ts   Q1–Q4 seasonal checklists  ⚠ see ASSUMPTIONS
  types/              Schema types, status colors
supabase/
  migrations/         0001 schema · 0002 RLS · 0003 storage · 0004 reports
  seed.sql            The Miller Home demo
docs/
  supabase-setup.md   Step-by-step connection guide
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
