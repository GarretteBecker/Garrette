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

### Known gaps

- PDF is browser-print, not server-generated — see `docs/ASSUMPTIONS.md` §7
- `docs/homekeeper-spec.md` is referenced by `CLAUDE.md` but does not exist;
  everything I had to invent in its absence is listed in `docs/ASSUMPTIONS.md`
- Trade portal is a placeholder (later phase, per the brief)
- Service request stages are stored and displayed but nothing advances them
- GoHighLevel integration not started (later phase, per the brief)
- No automated tests yet
- The portal reads data but does not yet write: submitting a service request
  from the member side is still to come
- **The scan's actual Claude call has never been run** — this environment has
  no API credentials. Everything around it is verified; the call itself is
  not. See `docs/ASSUMPTIONS.md` §9.
- No rate limiting on the scan endpoint (it is staff-only, but a stuck
  client could still loop)
- **The GHL webhook has never been fired at a real GHL account** — no
  credentials here. See `docs/ASSUMPTIONS.md` §10.
- Reads are not audited anywhere; writes are. See `SECURITY-REVIEW.md` item 12
- No rate limiting on the scan endpoint or member media upload
