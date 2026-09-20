# Connecting your Supabase account — step by step

Plain English, no assumptions. Total time: about 20 minutes, most of it waiting.

**What Supabase is, in one sentence:** it's the filing cabinet and the lock on
the door — it stores every property, asset, finding and photo, it handles who
can log in, and it enforces the rule that a member can only ever see their own
house.

You do this once. After that it just runs.

---

## Step 1 — Make a Supabase account

1. Go to **https://supabase.com** and click **Start your project**.
2. Sign in with GitHub (easiest) or an email address.
3. It's free to start. The free tier is plenty for the demo home and your
   first few real members.

## Step 2 — Create the project

1. Click **New project**.
2. **Name:** `bm-homekeeper`
3. **Database Password:** click Generate, then **copy it into your password
   manager**. You will not be shown it again. You don't need it for day-to-day
   use, but you'll want it if you ever restore a backup.
4. **Region:** choose **East US (North Virginia)**. It's the closest to
   Lancaster, which means the app feels faster.
5. Click **Create new project**.
6. Go get a coffee. It takes 2–3 minutes to build.

## Step 3 — Run the database setup scripts

This is where the tables, the security rules, and the demo home get created.

In the Supabase dashboard, click **SQL Editor** in the left sidebar, then
**New query**. You're going to paste in five files, **in this exact order**,
running each one before moving to the next.

For each file: open it from this repo, select all, copy, paste into the SQL
editor, click **Run**. You want to see "Success. No rows returned" each time.

| Order | File | What it does |
|-------|------|--------------|
| 1 | `supabase/migrations/0001_schema.sql` | Creates every table — properties, assets, findings, visits, all of it |
| 2 | `supabase/migrations/0002_rls.sql` | The security rules. **This is the important one** — it's what stops one member seeing another's house |
| 3 | `supabase/migrations/0003_storage.sql` | Creates the two private buckets for photos and documents |
| 4 | `supabase/migrations/0004_report_release.sql` | Adds the draft/release step so you review a report before the member sees it |
| 5 | `supabase/migrations/0005_photo_capture.sql` | Photo notes, photo types, and data-plate scan results |
| 6 | `supabase/seed.sql` | Loads the Miller Home demo and creates three test logins |

> **If a script errors:** stop. Don't run the next one. The most common cause
> is running them out of order, or running the same one twice. Tell me what
> the error said and I'll sort it.

## Step 4 — Get your two keys

1. In the sidebar click the **gear icon (Project Settings)**.
2. Click **Data API**.
3. You need two values off this page:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon / public key** — a long string starting `eyJ...`

Both of these are safe to put in the app and safe to have in a browser. The
anon key on its own grants nobody anything — the security rules from Step 3
are what actually decide who sees what.

**The `service_role` key on that same page is different. Never put it in this
app, never email it, never paste it into a chat.** It bypasses every security
rule. This codebase deliberately has no place to put it.

## Step 5 — Tell the app about your project

In the project folder, copy `.env.example` to a new file called `.env.local`,
then paste your two values in:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...your long key...
```

Save it. `.env.local` is already set to never get committed to git, so your
keys stay on your machine.

### Optional: turn on data-plate scanning

If you want the "Scan data plate" button to actually read placards, add a
third line:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Get one at **console.anthropic.com → API Keys**. Each scan costs a fraction
of a cent.

Skip this and everything else still works — the camera captures and stores
photos exactly the same, you just type the model and serial in by hand.

Unlike the two Supabase values, **this one is a real secret**: it stays on
the server, never goes to the browser, and must never be committed or
pasted into a chat.

## Step 6 — Run it

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. You should get the navy login screen.

## Step 7 — Log in and look around

Three test accounts were created by the seed file. Same password for all
three:

| Role | Email | Password |
|------|-------|----------|
| Admin (you) | `admin@bmhomekeeper.test` | `HomeKeeper!2026` |
| Technician | `tech@bmhomekeeper.test` | `HomeKeeper!2026` |
| Member (homeowner) | `member@bmhomekeeper.test` | `HomeKeeper!2026` |

Each one lands somewhere different — admin at the property list, tech at
today's visits, member at their own Home Record. That's the role system
working.

> **These are demo accounts with a password that's published in this repo.**
> Before you put a single real customer in this system, delete all three in
> **Authentication → Users** and create real accounts.

---

## Testing it on your phone

While `npm run dev` is running, find your computer's local IP address:

- **Mac:** System Settings → Wi-Fi → Details → IP address
- **Windows:** `ipconfig` in Command Prompt, look for IPv4 Address

Then on your phone, on the **same Wi-Fi**, go to `http://THAT-IP:3000`.

In Safari, tap Share → **Add to Home Screen** and it installs like a real app,
full screen, no browser bars. That's the PWA part.

---

## Proving the security actually works

Don't take my word for rule 2. Test it yourself — it takes a minute:

1. Log in as `member@bmhomekeeper.test`.
2. You'll see the Miller Home. Copy the property ID out of the URL bar.
3. Now try to reach a different property's page directly by editing the URL.
4. You get nothing — not a blank page you could hack around, but no data at
   all, because Postgres itself refuses to return the rows.

That refusal happens in the database, underneath the app. Even if someone
found a bug in a screen, or hit the API directly with the anon key, they'd
still get nothing.

For the thorough version, run **`supabase/tests/rls-verification.sql`** in the
SQL Editor. It creates a second fake property, checks from each role's point
of view that nothing leaks, and cleans up after itself. Every "leak" count
should come back 0. Re-run it any time the security rules change.

---

## When you're ready to put it online

1. Push this repo to GitHub.
2. Go to **vercel.com**, sign in with GitHub, click **Add New → Project**,
   pick this repo.
3. Before you click Deploy, open **Environment Variables** and add the same
   two values from Step 5.
4. Deploy. You get a live URL in about a minute.

Your Supabase project needs no change — it's already reachable from Vercel.
