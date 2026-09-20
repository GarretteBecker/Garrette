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

### Known gaps

- PDF is browser-print, not server-generated — see `docs/ASSUMPTIONS.md` §7
- `docs/homekeeper-spec.md` is referenced by `CLAUDE.md` but does not exist;
  everything I had to invent in its absence is listed in `docs/ASSUMPTIONS.md`
- Trade portal is a placeholder (later phase, per the brief)
- Service request stages are stored and displayed but nothing advances them
- GoHighLevel integration not started (later phase, per the brief)
- No automated tests yet
