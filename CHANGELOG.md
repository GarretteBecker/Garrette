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
