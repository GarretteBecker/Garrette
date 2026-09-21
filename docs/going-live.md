# Going live — logins, hosting, your own web address, and what still needs a developer

---

## 1. Every login that exists

There are **five roles**. There is **one login page**: `/login`. Everyone
uses it, and the app sends you to the right place based on who you are.

| Role | Lands on | Sees |
|---|---|---|
| **Owner / Admin** | `/team` | Everything, including pricing, membership terms, staff accounts and the checklist standard |
| **Office** (new) | `/team` | Members, properties, scheduling, requests, reports, trades. **Not** pricing, **not** accounts |
| **Field technician** | `/field` | Only their assigned visits and properties |
| **Homeowner** | `/home` | Only their own home |
| **Trade partner** | `/trade` | Only jobs dispatched to them |

**The demo needs no login at all:** `/demo` is hardcoded sample data that
never touches the database. Use it for sales.

### The three demo logins

These come from `supabase/seed.sql`. The password is published in the repo,
so **these are for clicking through the app, not for real use**:

| Email | Password | Role |
|---|---|---|
| `admin@bmhomekeeper.test` | `HomeKeeper!2026` | Owner |
| `tech@bmhomekeeper.test` | `HomeKeeper!2026` | Technician |
| `member@bmhomekeeper.test` | `HomeKeeper!2026` | Homeowner |

⚠️ **Before real customers:** create your own owner account by invite, sign
in with it, then delete these three from Supabase → Authentication → Users.

---

## 2. Is it deployed?

**I cannot tell you.** I have no access to your Vercel or Netlify account,
and nothing in the code records a live URL. Open your hosting dashboard and
look — that is the only honest answer.

**There is a conflict you need to settle first.** The repo contains a
`netlify.toml`, but `docs/deploy-vercel.md` walks you through Vercel. Pick
one:

- **Staying on Vercel?** Delete `netlify.toml`. Follow `docs/deploy-vercel.md`.
- **Staying on Netlify?** Keep it, and ignore the Vercel doc.

Either works. Having both configured is just confusing later.

### Environment variables your host needs

Set these in the hosting dashboard, never in the code:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_BM_EMERGENCY_PHONE
NEXT_PUBLIC_GAS_UTILITY_NAME / _PHONE
NEXT_PUBLIC_ELECTRIC_UTILITY_NAME / _PHONE
NEXT_PUBLIC_WATER_UTILITY_NAME / _PHONE
ANTHROPIC_API_KEY          (for the data-plate scan)
GHL_WEBHOOK_URL_*          (GoHighLevel, optional)
```

If the Supabase two are missing, the login page says so plainly rather than
failing silently.

---

## 3. Your own web address

Goal: **app.bmhomeimprovementsolutionsllc.com**

`app.` is a subdomain — your main site stays exactly where it is. Nothing
here touches your existing website.

### On Vercel

1. Project → **Settings → Domains**
2. Type `app.bmhomeimprovementsolutionsllc.com`, click **Add**
3. Vercel shows you a **CNAME** record: name `app`, value `cname.vercel-dns.com`

### On Netlify

1. Site → **Domain management → Add a domain**
2. Same thing: a **CNAME** for `app` pointing at your Netlify site address

### If your domain lives in GoHighLevel

You can do the whole thing in GHL — **but use the right screen.** GHL has
two domain features and only one of them is what you want:

| Screen | What it does | Use it? |
|---|---|---|
| **Add / Connect Domain** | Points a domain at a GHL funnel or website, so GHL serves it | ❌ **No.** This would make GHL answer for `app.` instead of your app |
| **Domains → your domain → DNS Records → Add Record** | Plain DNS record editing | ✅ **Yes.** This is the one |

For a domain **purchased through HighLevel**, GHL manages the DNS zone and
lets you add A, CNAME, AAAA, MX and TXT records yourself. A CNAME can point
anywhere — it does not have to point at GHL.

1. GHL → **Settings → Domains** (or the domain purchase area)
2. Open `bmhomeimprovementsolutionsllc.com`
3. **DNS Records → Add Record**
4. Type: **CNAME** · Name: **app** · Value: whatever Vercel or Netlify gave you
5. Save

⚠️ **One thing to know before you do it this way.** If your DNS lives in
GHL, then GHL is a dependency of the app being reachable at all. If that
account ever lapses or you move off HighLevel, `app.` stops resolving until
you move the DNS. That is survivable — you would just re-create the record
at a registrar — but it is worth knowing that the marketing platform and
the members' app would share a single point of failure.

If you would rather they were independent, keep the domain's DNS at your
registrar (or Cloudflare, free) and point *both* GHL and this app at it
from there.

### If your domain is registered somewhere else

(GoDaddy, Namecheap, Cloudflare, whoever.) GHL cannot edit DNS for a
domain whose zone it does not host, so this is where the record goes.

1. Find **DNS** / **Manage DNS** / **DNS records**
2. **Add record** →
   - Type: **CNAME**
   - Name / Host: **app**  *(just `app`, not the whole address)*
   - Value / Points to: whatever your host gave you
   - TTL: leave it alone
3. Save

Then wait. Usually minutes, occasionally a few hours. Your host's domain
page will go green when it works, and HTTPS is switched on for you.

---

## 4. Public sign-up is off — and it is off properly

**Nobody can create an account without an invite.** This is enforced by a
database trigger, not a checkbox:

- The invite lives in the `invites` table, written from **Team → Invite somebody**
- A sign-up whose email has no unexpired invite is **refused by the database**
- Their role comes from **the invite you wrote**, never from the sign-up form

Why that matters: the `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design —
it ships to every browser. Anyone who views source has it. If invite-only
were just a dashboard setting, one wrong click would open the doors. It is
a trigger, so it holds regardless.

**Belt and braces (worth doing anyway):** Supabase → Authentication →
Providers → Email → turn **"Enable sign ups"** off. Then only people you
create in the dashboard, or invite here, can get in at all.

---

## 5. Put it on your phone's home screen

It is a proper installable app — no App Store, no download.

**iPhone (Safari — it must be Safari):**
1. Open `app.bmhomeimprovementsolutionsllc.com`
2. Tap the **Share** button (square with an arrow, at the bottom)
3. Scroll down → **Add to Home Screen**
4. Name it **HomeKeeper** → **Add**

**Android (Chrome):**
1. Open the same address
2. Tap the **⋮** menu, top right
3. **Install app** or **Add to Home screen**

It opens full screen with no browser bar. Your techs should do this on
their work phones — the field app is built for it.

---

## 6. The demo home stays out of your books

There are two demos and only one was ever a risk:

- **`/demo`** — hardcoded, no database. Always safe.
- **The Miller Home** — a *real row* in your real database, put there by
  the setup script.

That second one was being counted as a member, added to your monthly
recurring revenue, and listed for renewal. It is now flagged `is_demo`:

- Left out of the member count, MRR and the renewal list
- Labelled **Sales demo** wherever it appears
- Still fully clickable for selling

**Do not add real members to the Miller Home**, and do not delete it unless
you want to lose your demo.

---

## 7. What a human developer still needs to look at

I am being straight with you: this is a real list, not a formality.

**Before real customers' data goes in:**

1. **The PA membership agreement wording** (`lib/agreements.ts`) — a
   Pennsylvania attorney, not a developer. I could verify HICPA's
   three-day rescission; I could **not** verify the renewal-notice window
   the spec assumed, so it is configurable and documented as uncertain.
2. **A penetration test against your live Supabase project.** Everything
   here is verified against a local copy of the schema. Your live project
   has its own settings — JWT expiry, password rules, rate limits, email
   confirmation — and none of those are in this code.
3. **Supabase backups.** Check point-in-time recovery is on for your plan.
   Nothing in this repo can do that for you.
4. **The Claude data-plate scan has never run** — no API credentials in my
   environment. Everything around it is tested; the call itself is not.
5. **The GoHighLevel webhooks have never fired at a real GHL account.**
6. **Rate limiting.** There is none on the scan endpoint or on member
   uploads. A determined person could run up your Anthropic bill.
7. **Reads are not audited.** Writes are. If you ever need to prove who
   looked at what, that work has not been done.

**What I have verified, and how:**

- All **23 tables** have Row Level Security **enabled and forced**, every
  one with policies. Forced matters: it means even the table's owner is
  subject to them.
- Isolation was tested with **real data on a second property first** —
  counts prove nothing when the other house is empty. Owner and office
  reach 1 row of the second house in every table; **technician and
  homeowner reach 0 in all of them**, including when naming its id directly.
- The office role: can book visits, edit the Home Record, move requests.
  Cannot promote itself, invite anyone, create or delete a property, change
  pricing, or change the checklist standard.
- Uninvited sign-up is refused. So is an expired invite, and a reused one.
- A sign-up claiming `"role":"admin"` in its metadata gets the role from
  the invite instead.
