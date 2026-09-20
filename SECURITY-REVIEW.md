# Security review — B&M HomeKeeper

**Reviewed:** 20 September 2026
**Scope:** the whole application as it stands on branch `claude/modest-hopper-sec57s`
**Method:** the schema was built on a local PostgreSQL 16 instance with a
Supabase-shaped harness (`auth.users`, `auth.uid()`, `storage.objects`, the
`authenticated` / `anon` roles) and then attacked directly in SQL, as each
role in turn. Findings were fixed and every test re-run against the fix.

> **Read the limitations section before trusting any of this.** This was an
> honest attempt to break the app, not a certification, and it was not run
> against your real Supabase project.

---

## Headline

**One critical vulnerability was found and fixed.** Anyone holding the public
anon key — which ships in the browser by design — could have made themselves
an administrator and read every property in the system.

Two lower-severity issues and one functional bug were also found and fixed.
Member isolation itself, the rule this app is built around, held under every
test.

Everything below was fixed in `supabase/migrations/0007_security_hardening.sql`.
**That migration has not been run against your Supabase project yet.**

---

## Findings

### CRITICAL-1 — Privilege escalation through signup metadata · FIXED

`handle_new_user` trusted the `role` field in signup metadata. That field is
supplied by whoever calls the signup endpoint. With the anon key (public by
design, visible in any browser), an attacker could run:

```js
supabase.auth.signUp({
  email, password,
  options: { data: { role: 'admin' } },
})
```

and receive an **admin** profile.

**Verified exploitable.** In testing, the attacker's profile came back with
`role = admin` and they could read both properties in the database, including
the one belonging to another household. That is a total failure of
`CLAUDE.md` rule 2.

**Fix:** a new auth user is now *always* created as `member`, regardless of
what the signup call claims. Roles are granted afterwards by an admin, which
`prevent_role_escalation` already restricts.

**After the fix:** the same attack yields `role = member` and **0** visible
properties. Self-promotion by UPDATE is rejected.

> **This one has a configuration half you must do yourself** — see
> "Before real customer data", item 1.

### MEDIUM-2 — A member could forge fields on their own request · FIXED

The insert policy on `service_requests` checked the *property* but not the
*columns*. A member could submit a request already marked `APPROVED`, with an
estimate, an approval timestamp and a trade partner attached.

No cross-property leak — it was always their own property — but it puts false
history on the office's board, and a request that looks approved when nobody
approved it is a commercial problem.

**Fix:** a `before insert` trigger forces member-submitted requests to
`stage = NEW` and nulls the estimate, approval, scheduling, dispatch and
completion fields. Staff inserts are untouched.

**After the fix:** the forged insert lands as `NEW` with every forged field
null.

### MEDIUM-3 — Two functions without a pinned `search_path` · FIXED

`set_updated_at` and `storage_property_id` did not pin `search_path`. Neither
is `SECURITY DEFINER`, so the practical risk was low, but an unpinned search
path is a loose end. Both now pin it. Every `SECURITY DEFINER` function
already did.

### BUG-4 — Member-raised requests had no history · FIXED

Found while testing the events policy. The policy correctly refuses to let a
member write their own stage history — but the app was *trying* to insert the
opening "Submitted through the member portal" event as the member. RLS
silently refused it and the error was not checked, so a member's own timeline
started empty.

**Fix:** the opening event is now written by a database trigger. It is always
present and still not forgeable by the member.

### LOW-5 — Seeded reports were invisible to the demo member · FIXED

Not a security issue; found by the same tests. Migration 0004's backfill runs
*before* `seed.sql`, so seeded reports stayed `DRAFT` and the member portal
showed none. The seed now sets `RELEASED` explicitly.

### INFORMATIONAL-6 — Staff contact details are visible to every member

The `profiles_select_staff` policy lets any signed-in user read the full
profile row of every `admin` and `tech` — including **email address and phone
number**.

This is deliberate: a member should be able to see which technician is coming
to their house. But it does mean a member can enumerate your staff's contact
details. For a small contractor that is almost certainly fine. **Decide
consciously rather than inheriting my decision** — if you would rather not,
the fix is to narrow that policy to name and role only via a view.

---

## What was tested

### Member isolation — the rule 2 test

A complete second property ("VICTIM HOME") was created with rows in **every**
property-scoped table: property, member, profile, room, asset, visit,
checklist item, finding, plan item, service request, request event, document,
photo, report, tech assignment, and storage objects in both buckets.

Then, as the Miller member, every one of those tables was queried.

**Result: 0 rows from the other property, on every table, including storage.**

| Table | Victim rows visible |
|---|---|
| properties, members, profiles | 0 |
| rooms, assets, visits, checklist_items | 0 |
| findings, plan_items, reports, documents, photos | 0 |
| service_requests, service_request_events | 0 |
| trade_partners, property_techs | 0 (not visible at all to members) |
| storage.objects (both buckets) | 0 |

### Every RLS policy

All 16 tables in `public` were confirmed to have RLS **enabled and forced**,
each with at least two policies. No table is missing a policy, and none is
readable by default.

| Role | Result |
|---|---|
| **Anonymous** (no session) | 0 rows on every table and both storage buckets |
| **Member** | Own property only; read-only except raising a request and attaching media to it |
| **Tech** | Only properties they are assigned to; cannot write to or delete from an unassigned property; cannot delete anything |
| **Admin** | Everything, as intended |

Specific denials confirmed by test: a member cannot log a finding, cannot
write stage history, cannot move a stage, cannot edit another user's profile,
cannot promote themselves. A tech cannot delete a finding (0 rows deletable).

### File storage

Both buckets are private (`public = false`); every read goes through a
short-lived signed URL, and signing itself is gated by RLS on the object
path.

Member upload attempts, all tested:

| Attempt | Result |
|---|---|
| Own property, `requests/` prefix | **Allowed** (intended) |
| Own property, `captures/` prefix (staff area) | Denied |
| Another property, `requests/` prefix | Denied |
| `property-docs` bucket | Denied |
| Delete or overwrite any object | Denied (0 deletable) |

The path convention is load-bearing: policies key on the property id being
the first path segment. `storage_property_id()` returns null rather than
raising on a malformed path, so the policies fail closed.

### Authentication and application layer

- **No service-role key anywhere in the codebase.** Every query, including
  inside the one API route, runs as the signed-in user, so RLS is always in
  force. There is no elevated path to abuse. Confirmed by grep across all
  source.
- **`/api/scan-plate`** requires a session *and* an `admin`/`tech` role. Read
  access alone is not sufficient, because a member can read their own photos
  and each scan costs money.
- **Middleware** gates every route except `/login`, `/demo`, `/offline` and
  static assets, and refreshes the session cookie. It is a convenience gate:
  the real boundary is RLS, and removing the middleware entirely would not
  expose data.
- **`/demo` is public and touches no database.** Confirmed: no Supabase
  import, no real identifiers in the fixture, entirely invented data.
- **The service worker never caches an authenticated page** — only static
  build assets and the offline page. A cached Home Record served to the wrong
  viewer is exactly the failure rule 2 exists to prevent.
- **Secrets:** only `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` reach the browser, both safe by design.
  `ANTHROPIC_API_KEY`, `GHL_WEBHOOK_URL` and `GHL_WEBHOOK_SECRET` are
  server-only. `.next` and `.env.local` are git-ignored. No key is committed.
- **Rule 3** holds: there is no column anywhere in the schema for an alarm
  code, password, safe combination or payment card, and the data-plate
  extraction prompt explicitly instructs the model to omit anything of that
  kind.

---

## Limitations — read this

**What this review is not:** it is not a penetration test, and it was not
performed by an independent security professional. Before real customer data
goes in, an independent review is worth paying for.

Specific gaps in what was tested:

1. **Tested against a local PostgreSQL harness, not your Supabase project.**
   The schema, policies and functions are identical — they are the same SQL
   files you run — but Supabase also has PostgREST, GoTrue and its storage
   API in front of Postgres. Those layers were not exercised. **The same
   tests should be re-run in your actual project** (`supabase/tests/`) after
   the migrations are applied.
2. **`auth.uid()` was simulated** by a session variable. Real JWT parsing,
   expiry and refresh were not tested.
3. **No testing of the live HTTP surface.** No fuzzing, no header or
   cookie tampering, no CSRF testing of server actions, no rate-limit
   testing.
4. **The GHL webhook and the scan endpoint have never run against their real
   services**, because this environment has no credentials for either.
5. **No dependency vulnerability audit beyond `npm audit`** (which reports 0
   vulnerabilities today — that is a floor, not an assurance).
6. **No review of Supabase project configuration**, which is where the
   remaining half of CRITICAL-1 lives. That is yours to check.

---

## Before real customer data goes in

Ordered by how much it matters.

### 1. Turn off public signup in Supabase — **do this first**

The code fix for CRITICAL-1 stops a self-registered user becoming an admin.
It does **not** stop someone self-registering at all. With signup open,
anyone can create a member account; they would see nothing (no property is
linked to them), but they would exist in your system.

In Supabase: **Authentication → Providers → Email**, and either disable
signups entirely or require email confirmation. Then create members yourself
from the admin side. Confirm by trying to sign up from a private window.

### 2. Delete the three demo accounts

`admin@bmhomekeeper.test`, `tech@bmhomekeeper.test`,
`member@bmhomekeeper.test` all share the password `HomeKeeper!2026`, which is
published in this repository. **Delete all three** in Supabase
**Authentication → Users** before the first real customer exists. Do not
merely change the password.

### 3. Run migration 0007

`supabase/migrations/0007_security_hardening.sql` contains all the fixes
above. Nothing is protected until it is applied.

### 4. Re-run the tests against the real project

`supabase/tests/rls-verification.sql` in the SQL editor. Every "leak" count
must be 0. Re-run it any time a policy changes.

### 5. Confirm the storage buckets really are private

**Storage → property-photos** and **property-docs** → both must show
**Private**. A bucket flipped to public bypasses every policy in this review
in one click.

### 6. Turn on MFA for the admin account

The admin account can read every property. It should not be protected by a
password alone. Supabase supports MFA; enable it for yours.

### 7. Check backups

Supabase's free tier has limited backup retention. Before real data:
confirm the backup schedule, and confirm point-in-time recovery is available
on your plan. Test a restore once — an untested backup is not a backup.

### 8. Scope the Vercel environment variables

In Vercel, environment variables can be scoped to Production / Preview /
Development. Preview deployments are publicly reachable by URL. Make sure
production Supabase keys are **not** exposed to Preview builds, or point
Preview at a separate Supabase project.

### 9. Decide about staff contact visibility

INFORMATIONAL-6 above. A conscious decision, not an accident.

### 10. Add rate limiting

Two endpoints are worth protecting, neither for data reasons — for cost:

- `/api/scan-plate` — staff-only, but a stuck client could loop and run up
  API charges.
- Member media upload — accepts video up to 100 MB with no per-member quota.

### 11. Think about the GHL webhook as a data export

When configured, HomeKeeper sends member names, addresses, phone numbers and
email addresses to GoHighLevel on every event. That is a deliberate feature,
but it means **your GHL account's security is now part of your customers'
data security**. Treat the webhook URL as a secret, and make sure GHL access
is locked down as carefully as this app.

### 12. Consider an audit log for reads

Writes are well recorded — stage history, who applied a scan, who released a
report. **Reads are not logged at all.** If you ever need to answer "did
anyone look at this customer's record", today you cannot. Worth adding before
you have enough customers for the question to arise.

---

## Re-testing after a change

Any change to `supabase/migrations/0002_rls.sql`, to a storage policy, or to
`handle_new_user` should be followed by:

1. `supabase/tests/rls-verification.sql` in the SQL editor — every leak count 0.
2. A manual check: sign in as a member, and try to reach another property by
   editing the URL. You should get nothing.
3. The signup check from item 1 above.

The single most important invariant, worth re-proving after any schema
change: **a member sees exactly one property, and it is theirs.**
