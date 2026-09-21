# Changelog

All notable changes to B&M HomeKeeper.

## [0.1.0] — 2026-09-20

First working build. Four phases, in the order they were asked for.

### Phase 1 — Foundation

- Next.js 16 (App Router) + TypeScript + Tailwind 4, installable as a PWA
- Brand tokens: navy `#1B2A4A`, green `#2E5E3A` (`app/globals.css`)
- Full Postgres schema for all 13 core data objects, plus `property_techs`
  (tech assignment) and `service_request_events` (stage history)
- **Row Level Security on every table**, deny-by-default, with the member
  isolation rule enforced in Postgres rather than in the UI
- Two private storage buckets (`property-photos`, `property-docs`) with
  policies keyed on the property id in the file path
- Email/password auth for all four roles; each role lands on its own home
  screen
- Demo seed: the Miller Home — 14 rooms, 36 Home Record items, 2 completed
  visits with full checklists, 12 findings across all 5 statuses, a 7-item
  Home Plan, 2 service requests, 4 trade partners, 5 documents
- Three test logins (admin / tech / member)
- Step-by-step Supabase connection guide (`docs/supabase-setup.md`)

### Phase 2 — Admin

- Property list with an open-ACTION count per property
- Property detail across 8 tabs: Overview, Home Record, Rooms, Findings,
  Visits, Home Plan, Requests, Documents
- Home Record create/edit with make, model, serial, install date, warranty,
  condition and expected life; searchable; warranty status flagged
  automatically (lifetime / under warranty / ends soon / ended)
- Photo upload per item, compressed in the browser before upload
- Room create/edit/delete
- Document upload with type classification, opened through short-lived
  signed URLs
- Trade partner directory with create/edit

### Phase 3 — Tech field app

- Today's visits, with the current season's focus up top
- Start a visit → the Q1–Q4 seasonal checklist is stamped onto it
- Whole-row tap cycles a checklist item Pass → Watch → Fail → N/A
- **Under-30-second finding capture**: photo, room, component, status, voice
  note, on one screen with no page transitions
- Voice-to-text via the browser's speech recognition
- Add or update Home Record items from the field
- **Works with no signal** — every action is written to an IndexedDB outbox
  first and drained in order when connectivity returns; the sync banner is
  always visible
- Complete Visit drafts the quarterly report automatically

### Phase 4 — Reports

- Quarterly HomeKeeper Report, 8 sections: property overview, status summary,
  the headline finding, work completed, findings with photos, Home Record
  updates, the open Home Plan, and improvements worth considering
- Annual Property Report over a calendar year
- Drafted automatically on visit completion; **the member cannot see it until
  an admin releases it** (enforced by RLS, not just the UI)
- Admin review queue at `/admin/reports`
- Print-ready at US Letter with brand colors preserved

### Phase 5 — Homeowner portal

- Mobile-first portal with a five-tab bottom bar: Home, Record, Plan,
  Reports, Docs
- **Dashboard** — a plain-English verdict on the home ("2 things need
  attention"), a status count row, the next scheduled visit, the top open
  recommendations with cost ranges and a running total, and a merged
  recent-activity timeline
- **My Home Record** — browse by room or by system, searchable across name,
  brand, model and serial; tap any item for a detail sheet with photos,
  warranty state, full specs, and an expected-service-life meter
- **Home Plan** — grouped Action / Plan / Monitor / Improvement, each item
  showing the recommendation, cost range and planned timing, under a total
  planned-investment figure
- **Reports** — every released report, opening into the branded report page
- **Documents** — manuals, warranties and permits grouped by type, opened
  through short-lived signed URLs
- **`/demo`** — the same portal components rendered from fixture data
  (`lib/member/demo-data.ts`) with no login and no database, for showing the
  product to a prospect. Clearly marked "Sample home" on every screen.
- Brand status colors verified against WCAG AA (worst case 5.02:1); portal
  rendered and reviewed at iPhone viewport

### Phase 6 — Capture & scan

- **One capture component used everywhere.** A photo can be attached to an
  item, a finding, a visit, a room, or the property itself, each with its
  own note. Same component in the office and the field, so they cannot
  drift apart.
- **Scan a data plate.** Point the camera at the placard on a water heater,
  furnace or condenser and it reads the brand, model, serial, date and
  capacity off it, plus whatever else is printed (BTU input, refrigerant,
  pressure).
- **A scan is a claim, not a fact.** The reading is stored against the
  photo and shown for review. Nothing reaches the Home Record until a human
  taps Save, and by default it only fills blanks — a misread can never
  silently overwrite something that was typed in.
- **Scanning a new item fills the form** instead of writing a row, so a tech
  can add equipment by photographing its plate. Photos captured before the
  item is saved are linked to it afterwards, in queue order.
- **Offline like everything else.** With no signal the photo goes in the
  outbox and both the upload and the scan run when signal returns.
- **Scanning is optional.** With no API key configured, capture still works
  end to end and the app says to type the numbers in by hand.
- New photo columns: `kind`, `note`, `scan_status`, `scan_data`,
  `scan_error`, `scan_applied_at`, plus `apply_scan_to_asset()`.
- A visit now has its own Photos tab for general shots.

### Phase 7 — Request Service, GoHighLevel, and going live

**Request Service, end to end**
- Member form: category, room, the Home Record item it concerns, a
  description, photos **and video**, and urgency in plain words
  (Emergency / Soon / Normal / Whenever)
- Office board grouped by stage down the page rather than across in
  columns, so it works on a phone; filter by any of the twelve stages
- Triage, dispatch to a trade partner, price it, book it, move the stage —
  each step logged with who did it and when
- Member sees live status the whole way through: the stage in their own
  language, who the ball is with, a progress rail and the full history
- **Closing out a job updates the Home Record by itself.** Work performed,
  parts, model and serial go onto the linked item, the job photos move
  across to it, and the stage advances to HOME RECORD UPDATED — in one
  transaction. Completion is the only route to COMPLETED, so a job cannot
  be marked done while the record quietly goes stale.
- Filling blanks only: a serial typed at the end of a long day never
  overwrites one already on the record.
- Members can now attach media to their own request — one new RLS door,
  scoped to their own property and their own request, tested from four
  angles.

**GoHighLevel**
- Events sent on report released, service request stage changed, and visit
  scheduled
- Each payload carries the contact, the property and flat merge-field data,
  including `member_status`, a ready-written `member_message`, and
  `waiting_on` so you can message only when the ball is in the member's court
- Sends run after the response and can never block or break the action they
  describe; with no URL configured the integration is simply off
- Visits can now be scheduled from the property page, which is what fires
  the visit event

**Installable phone app**
- Service worker, offline page, and a generated iOS touch icon
- Deliberately never caches authenticated pages — a cached Home Record
  served to the wrong person is exactly what rule 2 exists to prevent
- `docs/deploy-vercel.md` — GitHub, Vercel, custom domain, phone install
- `docs/gohighlevel.md` — webhook setup, payloads, and the API key

### Phase 8 — Security review and gap fixes

**Security review** (`SECURITY-REVIEW.md`) — schema built on PostgreSQL 16
and attacked as each role.

- **CRITICAL, fixed:** privilege escalation through signup metadata. Anyone
  with the public anon key could sign up with `options.data.role='admin'`
  and read every property. Verified exploitable, then fixed: new users are
  always created as `member`.
- **Medium, fixed:** a member could forge stage, estimate and dispatch fields
  on a request they submitted.
- **Medium, fixed:** two functions did not pin `search_path`.
- **Bug, fixed:** member-raised requests had no history, because the app tried
  to write the opening event as the member and RLS silently refused. A trigger
  writes it now.
- **Low, fixed:** seeded reports stayed DRAFT, so the demo member saw none.
- Verified after fixes: zero cross-property rows on all 16 tables and both
  storage buckets, against a fixture confirmed to actually contain them.

**Gaps closed**

- **Members can approve or decline an estimate** from their phone. Members
  stay read-only on the table; it goes through one narrow SECURITY DEFINER
  function that re-checks the caller, the property and the stage. Tested from
  six angles including a tech trying to use the member route.
- **Member submissions now queue offline**, like tech capture. With no signal
  the request and its photos go to the outbox and send themselves later;
  the member sees "Saved on your phone" rather than an error.
- **A GHL workflow per event.** Set `GHL_WEBHOOK_URL_REPORT_RELEASED`,
  `_REQUEST_STAGE` or `_VISIT_SCHEDULED` for a dedicated workflow;
  `GHL_WEBHOOK_URL` remains the fallback, and mixing the two works.

### Phase 10 — Files on a report

- The office can **attach files to a quarterly review or any other report**:
  a trade partner's service sheet, an inspection certificate, a write-up
  done elsewhere. Upload from the report page itself.
- Attachments appear as a section in the report, and are listed when it
  prints.
- **A file on a draft report stays hidden from the member.** Documents are
  property-scoped, so without a policy change an attachment would have shown
  up in the member's Documents list the moment it was uploaded — before
  anyone reviewed the report it belongs to. The documents read policy now
  hides report attachments until that report is released. Tested: a member
  sees 0 draft attachments, the released one, and their ordinary documents;
  an admin sees all.

### Phase 11 — Memberships: tiers, exclusions and member pricing

- **Two tiers, one source of truth** (`lib/membership.ts`): HomeKeeper Core
  at $69/month or $759 prepaid, HomeKeeper Response at $299/month or $3,289
  prepaid. Prices, inclusions, exclusions and the member discount all live
  in that one file, so a price shown on a quote and a price shown on the
  membership screen cannot drift apart.
- **The tier gates the product in the database, not the page.** A Core
  member who guessed a report address would otherwise have read a quarterly
  report they never paid for. The reports read policy now asks
  `property_has_feature()`, so the gate holds whatever the browser asks for.
  Tested: on a Core home the member sees 0 quarterly reports and still sees
  their annual one, while the office sees all of them.
- **A membership screen the member can actually read** (`/home/membership`,
  and `/demo/membership` for sales). What they pay, what they get with a
  tick against each item, what prepaying saves them, how much of their
  discount they have used this year, and — on Core — exactly what upgrading
  to Response would add.
- **What membership does not cover is on screen, in plain words.** Eight
  exclusions, each with a sentence explaining it. A member who believes
  repairs are included will argue the first invoice; a screen they can look
  at any time settles it better than a contract signed once.
- **Member pricing appears on the quote itself.** When the office prices a
  job, the member sees the standard price struck through, their member
  price, and what they saved — 5% on Core, 10% on Response, against an
  annual cap that is tracked across jobs rather than per job. When the cap
  limits the saving, it says so rather than quietly giving less than the
  headline rate.
- **The office sets tier, billing cycle and commitment** on the property
  Overview tab.
- New columns on `properties`: `tier`, `billing_cycle`, `commitment_start`,
  `commitment_months`, `member_discount_used_ytd`, `member_discount_year_start`
  (migration `0010`). `supabase/CATCH-UP.sql` applies it to a database that
  is already live, and is safe to run twice — verified, including that a
  re-run leaves a tier the office set by hand alone.

⚠ **The two discount caps are invented.** The spec says both tiers should
have an annual dollar cap on member pricing but gives no figures, so
`$500` (Core) and `$1,500` (Response) are placeholders standing in until
you set them. They are two constants in `lib/membership.ts`; changing them
changes every quote in the app. See `docs/ASSUMPTIONS.md`.

### Phase 12 — Approve, schedule, photograph, finish

The approval loop existed end to end but could not be *seen*: the sales demo
had no request detail page at all, so the Approve button only ever appeared
for a logged-in member on a request that happened to be awaiting approval.
Meanwhile an approval arrived in the office with nothing to mark it.

**The member approving**

- **The demo now runs the whole loop.** `/demo/requests/{id}` renders the
  same component the live portal uses, and one of the three fixture requests
  sits at *Waiting on you* with a price on it — so the Approve button is on
  screen during a sales call rather than described. The demo buttons respond
  and explain what would happen; nothing is written anywhere.
- **The price and the Approve button now sit above the history**, not below
  it. They were previously under twelve timeline entries — a button nobody
  would scroll to find.
- **"We have sent you a price — tap to approve it"** on the request list, so
  it is visible without opening anything.

**The office knowing**

- **An approval is now impossible to miss.** A green banner at the top of the
  request board naming each approved job, the property and when they
  approved; the same on the admin home screen; and an *Approved · needs a
  date* badge on the card itself so it reads inside a filtered view too.
- **The request page leads with it** — who approved, when, and for how much,
  with the Schedule box ringed green while a job is approved and unbooked.
- Both the Estimate and Schedule boxes now say what pressing the button does.

**Photographing the work**

- **B&M can photograph a job.** Capture can now target a service request, and
  the request page has a *Job photos* card with separate Before and After
  capture. Previously only the member could attach photos to a request, so
  the office had no way to record what it found or what it left behind.
- **Ours and theirs stay apart.** The member's submission photos sit under
  *What you told us*; our before/after shots under *What we did* — same
  table, told apart by photo kind, never blurred together.
- **The close-out says where the photos are going**, and says so plainly when
  there are none.
- Verified on PostgreSQL 16 against a fixture with the photos actually
  present: the office inserts before/after against a request, closing the job
  out advances it to HOME RECORD UPDATED and moves both photos onto the Home
  Record item along with the write-up, parts, service date and condition, and
  the member can see them on their own request.

### Phase 13 — Saying yes to the Home Plan

The Home Plan told a member what we recommend and roughly what it costs, and
then stopped. There was no way to say yes to any of it.

- **"Get me a price" on every actionable plan item.** Deliberately not an
  Approve button: the plan quotes a *range*, and approving a range is not an
  approval, it is an argument about the final invoice deferred to later. The
  button opens an ordinary job carrying our own recommendation across, and
  the pipeline you already have takes it from there — we price it firmly,
  they approve that firm number on the same screen they already know, with
  their member discount on it, and we book it.
- **MONITOR and GOOD items get no button.** Those are things we are watching,
  not work we are offering.
- **The card shows the job, not the button, once one exists** — where it has
  got to, in the member's own language, tapping through to the full request.
  A plan item and its job can never tell them two different things.
- **The office sees where it came from.** A job raised off the plan leads
  with our own recommendation and what we estimated, so whoever prices it is
  not working from a title alone.
- **Finishing the work clears it off the plan, by itself.** The finding
  resolves and the plan item goes to DONE. Without this the Home Plan would
  go on recommending a repair the member has already paid for.
- **The plan item follows its job automatically** — approved, scheduled,
  done — driven by a database trigger rather than by each code path that
  moves a stage, so the plan cannot drift out of step with reality.
- **No new permission was opened.** A member could already raise a request on
  their own property; the same trigger that strips a forged stage off a
  member's request strips it off this one.
- **A link cannot cross a property boundary.** Nothing previously stopped a
  hand-crafted request naming another property's finding. A trigger now
  refuses it — verified against a second property confirmed to actually hold
  the finding being reached for.
- Verified end to end on PostgreSQL 16: member asks (their forged
  `stage: APPROVED` is stripped back to NEW), office prices, member approves,
  plan item goes APPROVED → SCHEDULED, close-out resolves the finding and
  marks the item DONE, and it disappears from the member's open plan. Tested
  on a fresh database and on one upgraded through `CATCH-UP.sql`, which is
  still safe to run twice.

### Phase 14 — Pennsylvania compliance

⚠ **Not legal advice, and the wording has not been near a lawyer.** This
phase builds the machinery. `docs/pa-compliance.md` says what was verified,
what was not, and what an attorney still has to settle — read it before
signing anyone up.

**The three-business-day right to cancel — verified law**

Pennsylvania's Home Improvement Consumer Protection Act (73 P.S. § 517.1
et seq.) gives a homeowner three business days from signing to rescind, and
a non-conforming contract is unenforceable against them. B&M is a registered
PA contractor, so this one is not optional.

- **A real button, not a paragraph.** While the window is open the member's
  Membership screen leads with a countdown and **Cancel my membership**. A
  statutory right that depends on catching someone at a desk during office
  hours is a right with a handbrake on it.
- **The database sets the deadline**, from the signing date — not the form.
  A three-business-day right that rests on someone's mental arithmetic on a
  Friday afternoon is not a right.
- Cancelling goes through one narrow SECURITY DEFINER function. Tested from
  six angles: inside the window, after it closed, already cancelled, an
  admin, a technician, and a member from another property — against a
  fixture confirmed to hold two live agreements, so the refusals mean
  something.
- The right is stated whether or not it is still open, so a member finds the
  same sentence later that they signed.
- ⚠ **Weekends only — PA legal holidays are not modelled.** The error is
  always in the member's favour: a holiday inside the window makes the real
  deadline later than the one shown, never earlier.

**The renewal notice — could NOT be verified**

The spec asks for a notice 10–20 days before renewal. **I could not confirm
that is currently Pennsylvania law.** PA's own auto-renewal statute appears
to be narrow (health clubs and similar); broader bills are proposed, not
enacted. So the window is stored **per agreement** rather than hard-coded,
and counsel can change it without a code change. My advice is to send it
anyway — a member surprised by a renewal charge is a member lost, whatever
the statute says.

**Everything else**

- **The agreement lives in the app.** What they signed, when, at what price,
  for how long — with the signed document attached and readable from their
  phone. Prices are copied in at signing, so putting the price up next year
  cannot rewrite what somebody agreed to.
- **Auto-renewal disclosure and opt-out in plain English.** That it renews,
  when, at what price, and how to stop it. Opting out is any service request,
  email or phone call — no hoops.
- **A compliance desk** at `/admin/compliance`: reminders due, reminders
  **late**, who is still inside their cancellation window, whose signed copy
  was never filed, and which properties have no agreement at all. A late
  notice stays on the list rather than quietly dropping off.
- **Sending a reminder sends it and records it** — date, method and who —
  firing a GoHighLevel event so the message itself goes from GHL. Proof of
  notice is worth having regardless of which way the law lands.
- Two new webhook events: `GHL_WEBHOOK_URL_RENEWAL_NOTICE` and
  `GHL_WEBHOOK_URL_MEMBERSHIP_RESCINDED`.
- 16 unit tests on the date logic (window edges, notice states, countdown
  wording) and the business-day arithmetic verified on PostgreSQL 16 across
  weekday, Friday and weekend signings.

**Not built:** no signup flow, so there is nowhere yet to show the
disclosures *before* someone commits — if you add online signup, they must
appear before the payment step. No e-signature. No holiday calendar. No
retention policy.

### Phase 15 — "I need help now"

A red button at the top of the member's dashboard. They tap it, pick what is
happening, and get told what to do **in their own house** — their shutoff, in
their basement, with the photograph the technician took of it.

Anyone can publish "turn the water off at the main". Only B&M can say *"yours
is the red lever on the northwest wall just past the stairs"* and show them a
picture. That is the whole feature.

**Safety is the architecture, not a disclaimer.** `docs/emergency-help.md`
has the full reasoning; three rules govern it:

- **Life before property.** Gas and electrical open with a full-width red
  *Get everyone out now* card and a 911 button, above everything else. The
  gas screen **never** shows the gas shutoff and says outright: do not go
  looking for it, do not touch a switch. Sending somebody into a gassy
  basement to hunt for a valve is the worst thing this app could do.
- **The list order is part of the design.** "I smell gas" and "Burning smell"
  are first because a frightened person taps the first thing that matches.
- **Never invent their house.** No shutoff recorded? The screen says so and
  tells them to call. It does not guess and it does not show a stock photo of
  somebody else's valve.

**⚠ No phone number is written into this code except 911.** Utility numbers
vary by address and change; a wrong one on a gas screen is the worst possible
bug. They come from config, have **no defaults**, and do not render when
unset — the step still says where to find it (the bill). Set
`NEXT_PUBLIC_BM_EMERGENCY_PHONE` and there is a Call B&M button; until then
there is not one.

**Eleven emergencies**, each with ordered steps, a "please do not" list, and
the member's own equipment: gas smell, burning smell, water leak, basement
water, sewage backup, no heat, no hot water, no water, roof leak, appliance
leak, something else.

**Not tier-gated, deliberately.** Withholding "here is where your water
shutoff is" from a member on the cheaper plan is not a business model. The
tier gates the *response* — Response gets priority routing, Core gets an
honest "as soon as we can during business hours".

**The office side**

- **About the house** — water source, sewer type, heating fuel, service size,
  construction, roof. Water and sewer change the advice: a well home loses
  pressure in a power cut, a public home does not.
- **Shutoffs & access points** — record where each one is, how to work it,
  and photograph it with the camera already in the app. The card names which
  of the six the emergency screens need are still missing.
- Location notes are prompted to be written *"for somebody frightened, in the
  dark, who has never looked for it before"*.

**Also**

- Tapping "Log it with photos" from an emergency lands on the request form
  already filled in — urgent, right category, right title. Every emergency's
  category was checked against the real list rather than assumed.
- New property fields and a `safety_points` table (migration `0013`). Tested
  on PostgreSQL 16 against two households with shutoffs each: the member sees
  their five and none of the other home's, a member cannot write one, and the
  database refuses a shutoff captioned with another property's room.
- CLAUDE.md rule 3 holds — still no field anywhere for an alarm code, gate
  code, key location or combination. A shutoff is a valve anyone in the room
  can see; a key location is not.

### Phase 16 — Warranty watch

The app has stored a warranty expiry date on every Home Record item since
day one and never once used it. That was money sitting on the floor: a
member whose water heater fails ten weeks after the cover quietly lapsed
paid for a tank they did not have to.

**What the member sees**

> **Ends in about 2 months — Smart Thermostat**
> Your smart thermostat (ecobee Smart Thermostat Premium EB-STATE6) comes
> out of warranty in about 2 months. If anything is wrong with it, it is far
> cheaper to find out now than after.
> **[Have a look while it is covered]** · No thanks

Tapping it opens an ordinary job against that item, carrying the warranty
date across so whoever prices it knows the clock is running.

- **"No thanks" genuinely stops it** for that warranty period. A reminder
  somebody has already declined is a nag, and a nag is worse than silence.
  It goes through the same narrow SECURITY DEFINER route as estimate
  approval, so the member can do it from their phone without ringing anyone.
- **A later, genuinely new warranty period is not silenced by an old
  decline** — notices are keyed on the item *and* the date.
- **It sits under the hero, not above it.** The headline is still "is my
  home alright?"; a reminder that pushed that answer off the screen would be
  selling rather than serving.

**What the office sees**

`/admin/warranties` — everything coming out of cover in the next 120 days,
soonest first, in three groups: **nobody has told them** (today's work),
**told, waiting on them** (no chasing twice), and **they asked us to look**
(a job already exists). Anything declined drops off.

Pressing *Tell them* sends the reminder through a new GoHighLevel event —
`member_message` arrives already written — and records the date, method and
sender. "Did we tell them?" stops being a memory.

**One definition of "ending soon."** It reuses `warrantyInfo()` from
`lib/member/portal.ts`, which the Home Record already uses for its warranty
chips, so a card cannot say "ending soon" while the chip beside it says
"under warranty". 120 days, in one place.

**Also**

- New table `warranty_notices` and view `warranty_watch` (migration `0014`).
  Verified on PostgreSQL 16 across every boundary the window draws — 58 and
  119 days in, 121 days out, expired-yesterday out, six lifetime warranties
  correctly excluded — plus the decline being idempotent, refused for staff,
  and refused across a property boundary against a fixture confirmed to hold
  the other home's item.
- The seed and the demo fixture now carry two warranties dated **relative to
  today**. The hard-coded dates had already gone stale, which meant the
  feature would have looked broken on the demo home the day it shipped.
- 9 unit tests on the selection logic, including that an old decline does
  not silence a new warranty period.

### Phase 17 — A clean quarter reads like good news

A visit where nothing is wrong is the product working. It was the outcome
the report handled worst: the "What we found" section simply **vanished**, so
a perfect visit read as though the page had failed to load.

Now it says what actually happened:

> **No repairs recommended this quarter**
> We went through 13 checks on this visit and every one passed. There is
> nothing for you to do and nothing to budget for.

and where the findings list would have been empty:

> **What we found** — Nothing. All 13 checks passed.

The evidence is the point. "We checked thirteen things and every one passed"
is worth more to a careful homeowner than a list of problems, and it is the
sentence that renews a membership.

**It refuses to contradict itself.** The wording is generated from what the
report actually contains, so it never:

- claims a checklist count when no checklist was recorded
- says "nothing to report" while three MONITOR items sit further down the
  same page — it names them and says none of it needs doing now
- says "nothing to budget for" over a Home Plan that still has items on it —
  it says "nothing new to plan for, your Home Plan below is unchanged"

That last one was a real bug I caught in my own copy: the first version
announced "nothing to budget for" directly above a $17,100 plan.

**The status row and the headline changed too.** A row of five zeros read
flat; it now carries a line above it saying what the zeros mean. And "The
one thing to know" — which previously vanished with nothing to say — leads
with the clean result. An admin who explicitly chose a headline finding
still gets theirs.

**The demo's Reports tab was a dead end.** It linked at `/reports/<id>`,
which is behind the login wall, so on a sales call it stopped at exactly the
moment you want to hand somebody the thing they are buying. There is now a
`/demo/reports/<id>` rendering the **same** `ReportDocument` component the
live app uses — what a prospect sees is what a member gets.

`demo-r4` is deliberately a clean quarter, so you can show one.

**Also**

- The report page split into loading (`app/reports/[id]`) and document
  (`components/reports/report-document.tsx`). The page keeps RLS; the
  document is reusable.
- Demo checklists now use the **real** seasonal templates rather than
  invented labels, so the count in the headline and the ticks under "What we
  did" come from the same place and agree.
- 11 cases covered on the wording logic, including one check, no checklist,
  N/A items excluded, and a resolved ACTION not counting.

**Worth knowing:** the Q3 template is only **13 items**. The report's
credibility rests partly on that number, and 13 is thin for a full seasonal
visit. The audit already flags that the Q1-Q4 *themes* do not match your
spec; their *length* is worth a look at the same time.

### Phase 18 — Real dispatch, and a trade portal that works

"Dispatch" used to mean picking one partner from a flat list and moving a
stage. Whether anyone actually turned up depended on who you happened to
pick, and nothing recorded whether they answered, how long they took, or
whether they were any good.

A job is now **offered**, not assigned. The difference is the whole feature:
an offer has a deadline, an answer and a next step.

**A ranked bench per category.** Primary, secondary, backups — one primary
and one secondary each, enforced in the database, because two primaries is
not a ranking, it is the flat list this replaces. The Trades page calls out
any category with no primary: those are the jobs that wait for somebody to
think of a name.

**A clock on every offer.** Each partner has their own response window (a
roofer and an emergency plumber do not live at the same speed). The office
sees "2h 40m left" or "40m overdue" at a glance.

**Rollover.** Decline or go quiet and it rolls to the next in line. The
chain stays on the record — a primary who never answered reads as "no
answer in time", not as though they were skipped. When the bench runs out
the app says so plainly rather than failing silently: that is the moment to
pick up the phone.

**A trade portal that actually works.** It was a placeholder. A partner now
sees what they have been offered with the clock on it and answers with one
tap — accept, or decline with a reason. Without this, dispatch is still a
phone call somebody has to remember to log.

RLS does the scoping, not the UI: a partner reads only their own offers, and
only sees a request while they hold a live one on it. There is no property
list, no member list, and no route to the customer database from that
screen.

**Performance, measured rather than remembered.** Acceptance rate, average
response time, jobs completed — shown against each partner on the bench, so
ranking can be based on something. EXPIRED counts against a partner on
purpose: silence costs the member the whole clock. It refuses to grade
anyone on fewer than three answered offers, because three is not a track
record and a number presented as one would get somebody dropped for nothing.

**Also**

- New `dispatch.offered` GoHighLevel event. Point it at a workflow that
  **texts the trade**, not the member.
- `is_trade_for_request` extended so a partner can see a job they have been
  offered, not only one already assigned — otherwise they cannot decide
  whether to take it.
- The old one-dropdown assign action is gone; `dispatch_next` supersedes it.
- Verified on PostgreSQL 16 through the whole chain: primary offered → goes
  quiet → tries to answer late and is refused → rolls to the secondary on
  *their* SLA → secondary declines with a reason and the job returns to
  TRIAGE unassigned → rolls to the backup → bench runs out and returns
  nothing. Plus: a partner cannot answer another partner's offer (retested
  with a literal id after the first attempt turned out to be passing NULL
  through an RLS-filtered subquery), a member sees zero offers, two
  primaries in one category is refused, and the performance view reports
  50% / 0% / 0% correctly across three partners.
- 17 assertions on the display helpers — countdowns, overdue, tones, and the
  refusal to grade on a small sample.

### Phase 19 — Emergency moves into the header

The full-width red banner is gone. Emergency is now a small red button in
the top right of the header.

It is **better placed, not just quieter**. The banner only existed on the
dashboard, so a member who needed it from their Home Record or a report had
to navigate home first — which is not what anyone does when water is coming
through the ceiling. In the header it is in the same place on **every**
portal screen.

It is still a 40px tap target with the word *Emergency* on it, not a bare
icon, so it is findable without reading carefully.

The dashboard is calmer for it: the home's status is now the first thing a
member sees, with the camera and Request service under it, and the whole
thing fits one screen without scrolling.

The house icon that sat left of the title went with it — the title *is* the
home's name, so the icon was spending 32px to say the same thing twice, and
the emergency button needed that room. Checked at 375px with Sign out
present: nothing truncates.

### Phase 20 — The Home Baseline Report

The first document a new member ever receives. Until now that was a routine
quarterly report three months in, so their first impression of the product
was "we did a visit" rather than "we now know your house better than you
do".

The baseline is the other thing, and it is a different document rather than
a variant of the quarterly:

- **The house itself** — construction, water source, sewer type, heating
  fuel, electrical service, roof and its age, basement.
- **Where your shutoffs are** — each one with where it is, how to work it,
  and the photograph the technician took. The section a member should read
  before they need it.
- **Your Home Record** — every item, room by room, with make, model, serial
  and install date. Serials matter more than people expect: they are what
  turns a warranty claim or a part order from an afternoon into a phone
  call.
- **What is still under warranty**, soonest to expire.
- **The condition we found it in** — the five statuses, and the findings.
- **The next few years** — the Home Plan with a budget range.
- **What happens from here** — four numbered steps, including tapping
  Emergency.

**It drafts itself when an onboarding visit is completed**, so the first
report a member gets is the right one. For homes already on your books
there is a *Create the baseline report* button on the property Overview —
they never had an onboarding visit to hang it off, but the record exists,
so the report can be made from it today. One per home; a second would not
be a baseline.

**A Core member gets theirs.** The tier gate covers quarterly reports only —
verified: with the demo home set to Core, the member sees the baseline and
no quarterlies.

**A note on the migration.** Adding `BASELINE` to the report type is one
statement on purpose. PostgreSQL will not let a new enum value be *used* in
the same transaction that adds it, and the Supabase SQL editor may run a
whole script as one — so nothing downstream in `CATCH-UP.sql` or
`SETUP-EVERYTHING.sql` creates a report of that type. Both were tested
wrapped in an explicit transaction, and the catch-up three times over.

`/demo/reports/demo-r0` is a real one, so you can show it.

### Phase 21 — Propane is not natural gas

You sent three photographs — a water main, a gas meter, a propane tank —
and the third one is the one this app had no answer for. The database has
known since Phase 15 that a home can be heated by propane, but there was
nowhere to record the propane shutoff and the gas-leak screen quietly
assumed every home was on natural gas. Around here that is a lot of homes
told the wrong thing.

**The difference is physical, not editorial.**

| | Natural gas | Propane |
|---|---|---|
| Lighter or heavier than air | Lighter — rises and disperses | **Heavier — sinks and pools** in basements and along the floor |
| Where the shutoff is | At the meter, against the house | **On the tank, out in the yard** |
| What the app now says | Leave it to the utility | Close it from outside, if you can reach it safely |

**What a propane member sees when they tap "I smell gas":**

1. Leave the house, taking everyone with you
2. **Stay out of the basement and any low ground** — propane sinks, so the
   lowest part of the property is the worst place to be and the last place
   it clears
3. **From outside, close the valve on the tank — if you can reach it
   safely**, with their own tank's location, how the wheel turns, and the
   photograph. If the smell or the hissing is coming from the tank itself,
   the step tells them to stay away and skip it
4. From outside, call 911 and their propane supplier
5. Keep everyone away until they say it is safe
6. Nothing gets relit except by a technician — then tell us

Step 3 comes third, after *leave*, on purpose. A member who reads only step
one has still done the important thing. The natural gas screen is unchanged
and still never shows a shutoff during a leak — that member would have to
walk back towards the house to reach theirs.

**Also on a propane home:** "No heat" now starts with *check the tank gauge,
you may simply be out*, which is the commonest no-heat call there is, and
warns against relighting after a run-out — the system has to be leak-tested
first, and the supplier does that when they fill you. An oil home gets the
same step pointed at its own tank gauge.

**When we have not recorded a home's fuel, it gets the natural-gas screen**
— leave, call, touch nothing. The conservative one is the default.

**For you and your techs.** `Propane tank shutoff` is now a kind you can
record, and the *Shutoffs & access points* card asks for the right ones for
that house: a propane home is asked for its tank valve and not for a gas
meter it does not have, an all-electric home for neither. **Set the heating
fuel in *About the house* first** — that is what drives it. The form also
opens on the first thing still missing, and the "how to work it" placeholder
now shows what a good note looks like for whichever kind you picked.

**Verified.** Migrations applied in order on Postgres 16; `CATCH-UP.sql` and
`SETUP-EVERYTHING.sql` each applied wrapped in one explicit transaction, and
the catch-up's last line now reads *"Up to date. Everything through the
propane tank shutoff is in."* With a propane shutoff recorded on two
different houses, the member sees only her own — naming the other property's
id directly returns zero rows, and her insert is refused. The screens were
read at phone width.

**A note on the migration.** Same one-statement rule as the baseline report:
PostgreSQL will not let a new enum value be *used* in the transaction that
adds it, so nothing downstream of it creates a safety point of that kind.

**The photographs are still yours to take.** I did not put your three photos
into the app. Two of them are not B&M's — one is a video thumbnail — and
this app's rule is that it never shows a member a stock picture of somebody
else's valve. The demo propane tank has the words but no picture, which is
exactly what a real member sees until a tech photographs theirs.

### Known gaps

- PDF is browser-print, not server-generated — see `docs/ASSUMPTIONS.md` §7
- `docs/homekeeper-spec.md` is referenced by `CLAUDE.md` but does not exist;
  everything I had to invent in its absence is listed in `docs/ASSUMPTIONS.md`
- Trade portal is a placeholder (later phase, per the brief)
- No automated tests yet
- **The scan's actual Claude call has never been run** — this environment has
  no API credentials. Everything around it is verified; the call itself is
  not. See `docs/ASSUMPTIONS.md` §9.
- **The GHL webhook has never been fired at a real GHL account** — no
  credentials here. See `docs/ASSUMPTIONS.md` §10.
- Reads are not audited anywhere; writes are. See `SECURITY-REVIEW.md` item 12
- No rate limiting on the scan endpoint or member media upload
- Membership billing is not wired to anything — the tier, cycle and
  commitment are recorded, nothing charges a card. GoHighLevel handles
  billing, per the brief.
- **The emergency screens need signal.** They are authenticated pages and the
  service worker deliberately never caches those. A member with no signal
  cannot open "I need help now" — see `docs/emergency-help.md`.
- **The emergency guidance has not been reviewed by a licensed trade.** It is
  general homeowner advice of the kind a utility prints on a fridge magnet.
  Read `lib/emergency.ts` and correct anything you would not say yourself.
