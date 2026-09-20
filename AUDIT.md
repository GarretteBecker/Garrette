# HomeKeeper — audit against the membership specification

**Date:** 20 September 2026 · **Branch:** `claude/modest-hopper-sec57s`
**Method:** every verdict below was checked against the code, the migrations
and the seed data, not from memory. No application code was changed.

**Score at the time of the audit: 3 present, 8 partial, 5 missing.** The
field and request machinery is largely built. The *commercial* layer —
tiers, pricing, the Hub, the Passport, the legal disclosures — is the gap.

> **Updated 20 September 2026, after the memberships phase.** Items 1 and 13
> have moved (1: missing → partial, 13: missing → present); fix-list items
> 1, 2 and 4 are done. Each is marked below. **Score now: 4 present, 9
> partial, 3 missing.** Everything else stands as first written.
>
> **Also updated after the approve/schedule/photograph phase.** Item 7's
> approval loop is now visible in the sales demo, approvals are flagged to
> the office on the board and the admin home screen, and B&M can photograph
> a job before and after — the photos travel to the Home Record on close-out.
> Item 7 remains PARTIAL for the reasons already listed under it.
>
> **And after the Home Plan phase.** The Home Plan is no longer read-only: a
> member can ask for a firm price on any actionable item, it becomes a normal
> job, and finishing that job resolves the finding and closes the plan item.
>
> **And after the PA compliance phase.** Item 15 is substantially closed —
> agreement storage, auto-renewal disclosure, opt-out, renewal-notice
> tracking and a working three-business-day cancellation. What remains there
> is a lawyer's job, not a developer's.

---

## 1. Membership tiers — ~~MISSING~~ → **PARTIAL** *(was the largest gap)*

**At audit:** `properties.plan_tier` was a free-text column (the demo said
"HomeKeeper Premier", which is not even one of your two tiers). Nothing
gated anything — a Core member would have seen quarterly visits, quarterly
reports and every Response feature.

**Now present:** both tiers as defined values with $69/$759 and $299/$3,289
pricing and the 12-month commitment (`lib/membership.ts`, migration `0010`);
what each tier includes, on a screen the member can read; member-pricing
percentages, tracked against an annual cap across jobs; and the gate itself
— quarterly reports are Response-only **in RLS**, so it holds against a
guessed address, not just a hidden button.

**Still missing:** prepay-versus-two-months onboarding; the design-build
fixed credit; Water Protect as an add-on. The two discount **cap figures are
invented placeholders** ($500 Core, $1,500 Response) — the spec says caps
exist but never gives the numbers.

## 2. Snow removal removed — **PRESENT**

Swept the whole codebase, migrations, seed, checklists and copy for *snow,
plow, driveway, salt, deicer, winter service*. **No snow-removal content
exists anywhere.** Snow is not a Trade Network category.

Two keyword matches, both unrelated and both legitimate:
- "Water softener **salt** level" — softener salt, not road salt (Q2/Q4)
- "**Driveway**, walkway and step condition" — a condition inspection (Q3)

Neither implies a snow service. Flagging them only because you asked me to
search those words.

## 3. Home Record — **PARTIAL**

**Present:** address, year built, sq ft, bedrooms, bathrooms, lot size.
Rooms cover all the categories you list. Assets carry manufacturer, model,
serial, finish, install date, warranty, condition, location, expected life,
last-serviced, photos. Documents cover invoices, permits, manuals,
warranties, reports, plans, product info. **Every asset, visit, finding,
request, report and photo is tied to the property** — 11 tables are
property-scoped, verified.

**Missing at property level:** construction type, utilities, well vs public
water, septic vs public sewer, a dedicated main-shutoff location + photo
field, electrical service size, roof age, exterior materials, safety-device
summary. Several of these *exist as assets* in the demo (main shutoff, panel,
roof) but there is no structured property record for them — so nothing can
reliably pull "the member's own shutoff photo", which item 10 depends on.

**Missing on assets:** collection/series, size/dimensions, installer,
replacement parts (cartridge, filter size, belt). Filter sizes currently live
in free-text notes. Service history is implied through requests and notes
rather than being a structured history.

## 4. Field app — **PARTIAL**

**Present:** Q1–Q4 seasonal checklists; finding capture in well under 30
seconds one-handed (photo, room, component, status, voice note on one
screen); add/update assets on the spot; full offline operation with a local
queue that syncs later.

**Wrong:** the quarter *themes* do not match your spec. Mine are
winter/spring/summer/fall generic. Yours are Q1 winter health & safety, Q2
spring exterior & water, **Q3 kitchen/bath/interior** (mine is summer
cooling/pests), Q4 winter readiness **+ annual planning** (mine has no
planning step). This was flagged as an assumption from the start — there was
no spec to work from.

**Missing:** baseline visit mode. `visit_type` has an `ONBOARDING` value but
there is no distinct baseline flow, and no trade baseline reviews.

## 5. Finding status system — **PARTIAL**

**Present and exact:** the five statuses, the five colours, used
consistently, contrast-checked. IMPROVEMENT carries a preliminary investment
range.

**Partial:** IMPROVEMENT target timing only exists if someone separately
creates a linked Home Plan item — it is not a field on the finding.

**Missing:** a zero-recommendation visit does **not** display well. When
there are no findings, the "What we found" section simply vanishes from the
report. There is no "no repairs recommended this quarter" statement. Your
spec calls that a valid, good outcome, and right now it reads as though
something failed to load.

## 6. Three PDF report products — **PARTIAL**

**Present:** the Quarterly HomeKeeper Report, with all eight sections you
list. Navy/green branding and the PA licence footer. Admin review before
release. Attachments (added today).

**Partial:** the Annual report exists as a type but renders from the same
template — it is not a Property Passport (no year-over-year changes, no
remodel documentation, no warranty/permit roll-up).

**Missing:** the Home Baseline Report entirely. Floor plans. Trade review
sections. The 24-hour delivery commitment (no timer, no prompt, nothing
tracks it). **Quarterly reports are not gated to Response** — a Core member
would receive them.

## 7. Service request engine — **PARTIAL**

**Present and exact:** the twelve-stage lifecycle, in your order. Member
picks category → room → known asset → notes → photos **and video** →
urgency → submit. Property and asset auto-attach. Live status at all times;
no request can exist without one (enforced by a database default and a
trigger). On completion: work performed, parts, model/serial, photos — and
the linked asset updates automatically.

**Wrong:** categories are mine, not yours. Missing from mine: Handyman/
Carpentry, Bathroom, Kitchen, HVAC as its own word. Mine adds Garage,
Doors & windows.

**Missing:** the three pricing modes. There is one `estimate_amount` field —
no fixed-price approve-and-schedule, no instant preliminary range, no
professional-review path. Completion has no warranty or permit fields.

## 8. Trade Network dispatch — **MISSING**

What exists is a flat partner list: company, trade, contact, phone, email,
licence, active flag. Dispatch sets one partner and moves the stage.

Not present: Primary/Secondary/Backup ranking per category; service area;
COI tracking; pricing arrangement; hours; emergency capability; response SLA;
the partner-facing Accept / Need Information / Decline flow; rollover to
Secondary on decline or timeout; any performance tracking (acceptance rate,
response time, callback rate, documentation compliance, satisfaction,
revenue).

The trade portal is a placeholder screen. The RLS policies for trade access
exist and are correct, but nothing exercises them.

**One thing is right by default:** the member never sees a sub's phone
number, because there is nowhere in the app that shows it to them.

## 9. Member portal — **PARTIAL**

**Present:** My Home (browse by room *and* system, tap any asset for details,
photos, warranty, service life). My Home Plan grouped Action/Plan/Monitor/
Improvement with timing. My Reports. Request Service, now a large button at
the top of the screen. Approve quotes in-app (added recently, tightly
scoped). Works on phone and browser, installable.

**Missing:** **I Need Help Now** — does not exist anywhere. Member pricing
benefit shown on quotes — no percentage, no saving displayed, nothing.
Whether B&M can handle a plan item directly is not indicated.

**Wrong:** authentication is email + password. Your spec says passwordless or
modern auth. It is not a shared PIN, so it is not the failure mode you were
guarding against, but it is not what you asked for.

## 10. Response Hub (kiosk) — **MISSING**

Nothing exists. No kiosk mode, no five-button screen, no lock-down, no
tablet layout, no urgent-help triage, no safety playbooks, no property-
specific emergency instructions.

This is the flagship feature of your $299 tier and the reason someone pays
four times Core.

## 11. AI assistant — **MISSING**

No assistant of any kind. The only AI in the app reads equipment data plates
from a photo. It cannot answer "where's my shutoff", "what filter does my
furnace take", or anything else from the property record.

## 12. Property Passport & transfer — **MISSING**

No export, no transfer, no authorization flow, no new-owner welcome. The
words "not a warranty" and "not a substitute for a buyer's inspection" appear
nowhere. The data that would populate it largely exists; the product does
not.

## 13. What's excluded — ~~MISSING~~ → **PRESENT**

**At audit:** no exclusions appeared anywhere in the app; they lived only in
a contract signed once.

**Now:** eight exclusions, each with a sentence explaining it, on the
membership screen at `/home/membership` (and in the sales demo). Held in
`EXCLUSIONS` in `lib/membership.ts` so there is one list, not one per
screen.

## 14. Never store — **PRESENT**

Verified across every migration: there is **no column anywhere** for an alarm
code, gate code, safe combination, access credential, password or payment
card. The schema carries an explicit comment recording that this is
deliberate. The data-plate scanner is instructed to omit anything of that
kind if it appears in a photograph.

## 15. PA compliance — ~~PARTIAL~~ → **PARTIAL, substantially closed**

**At audit:** only the licence number. No stored agreement, no auto-renewal
disclosure, no opt-out, no renewal notice, no cancellation right.

**Now present:** the agreement is stored and readable in the portal; the
auto-renewal disclosure and opt-out are on the member's Membership screen in
plain English; the renewal notice is tracked, sent and logged from a
compliance desk; and the three-business-day cancellation right is a working
button whose deadline the database sets from the signing date.

**Still open:** no signup flow, so there is nowhere to present the
disclosures *before* someone commits; no e-signature; PA legal holidays are
not modelled in the business-day maths (erring in the member's favour); and
**none of the wording has been reviewed by a Pennsylvania attorney.** The
10–20 day renewal window could not be verified as current PA law. See
`docs/pa-compliance.md`.

## 16. Security — **PRESENT**

Independently audited today; full write-up in `SECURITY-REVIEW.md`.

A member cannot reach another property's data by any route tested: zero rows
across all 16 tables and both storage buckets, verified against a fixture
confirmed to actually contain the other property's data. RLS is enabled and
forced on every table. Storage permissions confirmed for reads, writes,
overwrites and deletes. Anonymous callers see nothing.

One critical vulnerability was found and fixed during that audit (privilege
escalation through signup metadata).

**Caveat on trade partners:** the policies restrict a partner to their own
dispatched jobs and they cannot reach the customer database. That is correct
in the schema but **untested in practice**, because no trade portal exists to
exercise it.

---

# Prioritized fix list

## Tier 1 — costs you money or creates liability

1. ~~**Tier model and UI gating.**~~ **DONE.** Gating is enforced in RLS, not
   only in the UI, so a Core member cannot reach a quarterly report by any
   route. *Remaining under item 1: onboarding options, design-build credit,
   Water Protect, and the real cap figures.*
2. ~~**Exclusions visible in-app (item 13).**~~ **DONE.** Eight exclusions on
   the membership screen, each explained.
3. ~~**PA compliance (item 15).**~~ **LARGELY DONE.** Disclosure, opt-out,
   notice tracking and a working cancellation button are all in. *What
   remains is not code: a Pennsylvania attorney has to read the wording, and
   settle whether a membership is a "home improvement contract" under HICPA
   at all.*
4. ~~**Member pricing not shown.**~~ **DONE.** The member sees the standard
   price struck through, their price and their saving on every quote, and
   how much of their annual cap is left.
5. **No 24-hour report delivery tracking.** A promise nothing measures.

## Tier 2 — a homeowner notices on a demo

6. **I Need Help Now.** The most visible absence in the member portal.
7. **Zero-findings report.** A clean quarter currently looks like a bug.
8. **Baseline Report** — the first document a new member ever receives.
9. **Request categories** aligned to your eleven.
10. **Q1–Q4 checklist themes** corrected to yours, especially Q3.
11. **Property-level Home Record fields** — construction, utilities, water,
    sewer, shutoff location and photo. Item 10 depends on these existing.

## Tier 3 — substantial products in their own right

12. **Response Hub** — the reason the $299 tier exists.
13. **Trade Network dispatch** — ranking, SLA, accept/decline, rollover,
    performance.
14. **Property Passport & transfer.**
15. **AI assistant** over the property record.
16. Three pricing modes; asset fields (collection, size, installer, parts);
    warranty/permit on completion; passwordless auth.
