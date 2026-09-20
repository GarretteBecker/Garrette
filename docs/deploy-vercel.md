# Putting HomeKeeper online — step by step

Plain English. About 30 minutes, most of it waiting.

**What you are doing:** GitHub stores the code. Vercel takes that code and
runs it on the internet at a real web address. Supabase (which you already
set up) holds the data. Three services, each doing one job.

> **I cannot do this part for you.** Vercel needs to be connected to *your*
> GitHub account and *your* payment details, and I have no access to either.
> Everything below is you clicking, with me telling you exactly where.

---

## Part 1 — Get the code onto GitHub

If you can already see this code at github.com, skip to Part 2.

1. Go to **https://github.com** and sign in (or create a free account).
2. Click the **+** at the top right → **New repository**.
3. **Repository name:** `homekeeper`
4. **Set it to Private.** This is your business's code — there is no reason
   for it to be public.
5. Do **not** tick "Add a README" — the code already has one.
6. Click **Create repository**.
7. GitHub then shows you a page of commands. Use the block headed
   **"…or push an existing repository from the command line"** and run those
   lines in a terminal, in the project folder.

**Sanity check:** refresh the GitHub page. You should see the files.

---

## Part 2 — Connect Vercel

1. Go to **https://vercel.com** and click **Sign Up**.
2. Choose **Continue with GitHub**. This is the important bit — signing up
   with GitHub is what lets Vercel see your code.
3. Approve the permissions GitHub asks about. You can limit it to just the
   `homekeeper` repository if you prefer.
4. On the Vercel dashboard, click **Add New… → Project**.
5. Find `homekeeper` in the list and click **Import**.

Vercel will detect Next.js on its own. Leave every build setting alone.

### Before you click Deploy — add your keys

This is the step people miss, and the deploy fails without it.

On the import screen, expand **Environment Variables** and add these:

| Name | Value | Required? |
|------|-------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as in your `.env.local` | **Yes** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as in your `.env.local` | **Yes** |
| `ANTHROPIC_API_KEY` | Your Anthropic key | Only for data-plate scanning |
| `GHL_WEBHOOK_URL` | From `docs/gohighlevel.md` | Only for GHL texts/emails |
| `GHL_WEBHOOK_SECRET` | Any long random string you make up | Only with the above |

Now click **Deploy**. Two to three minutes.

You get a URL like `homekeeper-xyz.vercel.app`. Open it — you should get the
navy login screen.

> **If the build fails:** almost always a missing environment variable. Open
> the build log, look for the line naming the variable, add it under
> **Settings → Environment Variables**, then **Deployments → ⋯ → Redeploy**.

### From now on

Every time code is pushed to GitHub, Vercel rebuilds and redeploys by itself.
You do not touch Vercel again.

---

## Part 3 — Your own web address

`homekeeper-xyz.vercel.app` works, but you want something like
`app.bmhomeimprovement.com` on a business card.

### If you already own the domain

1. In Vercel: **your project → Settings → Domains**.
2. Type the address you want — a subdomain like `app.yourdomain.com` is the
   usual choice, so your main website is untouched.
3. Click **Add**. Vercel shows you a **CNAME** record to create.
4. Go to wherever you bought the domain (GoDaddy, Namecheap, Google
   Domains…), find **DNS settings**, and add that record exactly as shown:
   - **Type:** CNAME
   - **Name/Host:** `app`
   - **Value/Points to:** the value Vercel gave you
5. Save, then go back to Vercel. It checks automatically.

**This takes anywhere from five minutes to a few hours** — that is DNS
propagating across the internet, not something being broken. Vercel turns
the domain green and sets up the padlock (HTTPS) on its own once it sees it.

### If you do not own a domain yet

Buy one first (about $12–15 a year), then follow the steps above. Namecheap
and Cloudflare are both fine.

---

## Part 4 — Install it on your phone

Once the site is live, HomeKeeper installs like a real app. No app store.

**iPhone (Safari — it must be Safari, not Chrome):**
1. Open your HomeKeeper address.
2. Tap the **Share** button (square with an arrow, bottom middle).
3. Scroll down → **Add to Home Screen**.
4. Tap **Add**.

**Android (Chrome):**
1. Open your HomeKeeper address.
2. Tap the **⋮** menu, top right.
3. Tap **Install app** (or **Add to Home Screen**).

You get a navy HomeKeeper icon. Opening it gives you the full screen with no
browser bars — it looks and behaves like an app.

**Do this on every phone that uses it:** yours, each tech's, and it is worth
walking a new member through it when you sign them up. It is the difference
between something they use and something they forget.

### What works with no signal

Once installed, a tech can open the app in a basement with no bars. Checklist
taps, findings, photos and Home Record edits all save to the phone and upload
by themselves when signal returns. The orange bar at the top tells them how
many changes are waiting.

Pages they have not opened yet will show an offline notice — that is
expected. Anything already captured is safe.

---

## Keeping it running

- **Cost:** Vercel's Hobby plan is free and fine to start. If you put it in
  front of paying members, their Pro plan is $20/month and worth it for the
  commercial terms. Supabase free tier covers your first properties; their
  paid tier starts at $25/month.
- **Updates:** push to GitHub, Vercel redeploys. Nothing else to do.
- **Rolling back a bad change:** Vercel → **Deployments**, find the last
  good one, **⋯ → Promote to Production**. Live again in seconds.
