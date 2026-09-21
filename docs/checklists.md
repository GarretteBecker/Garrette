# The seasonal checklists — how they work, and how you change them

## The short version

Go to **Admin → Checklists**. Pick a quarter. Edit it. That is the whole
thing — you do not need a developer, and you do not need me.

Until this phase the Q1–Q4 lists lived in a code file. That was wrong for
this product from the start: you are the one who knows what B&M checks, and
every change meant somebody else editing code. **A checklist you cannot edit
is somebody else's checklist.**

---

## What is on the screen

Four tabs, one per quarter, each showing how many items it has and whether
it is still on the built-in draft.

**The heading** — what the visit is called on the calendar, the season, the
months, and one line on why the quarter looks the way it does. That last
line prints on the member's report, so they can see the visit had a point
rather than being a walk-around.

**The items**, grouped by category. For each one:

| Field | Who sees it |
|---|---|
| What to check | The tech on the visit, and the member on their report |
| Category | Groups it on both |
| Note for the tech | **Techs only.** Never printed on a member's report |
| Only on certain homes | Nobody — it decides whether the item appears at all |

Reordering is two arrows rather than drag-and-drop, because dragging a row
on a phone in somebody's basement does not work.

---

## "Only on certain homes"

Leave everything unticked and the item goes on every house. Tick something
and it only appears where it applies:

- a **septic** check stays off a public-sewer house
- a **well** check stays off a house on public water
- a **propane tank** check stays off an all-electric house

This reads from *About the house* on the property, so **fill that in first**
— water source, sewer type and heating fuel. A house whose facts have not
been recorded keeps every item: better a technician ticking "not applicable"
than a check that is silently never offered.

---

## What editing does NOT do

**It never rewrites a visit that has already happened.** A visit takes its
own copy of the list the moment it starts, and owns it from then on. Editing
the Q3 list in March cannot change what a tech recorded last August — which
matters, because that record is what a member was shown and what their
report was built from.

It also does not touch a visit that is already in progress.

---

## The built-in draft

A quarter that has never been set up shows an amber card and a **"start from
the built-in list"** button. That copies in a starting point for you to mark
up — change the wording, drop what you do not do, add what you do.

⚠️ **The draft is not B&M's list.** It was written from standard Lancaster
County practice and the equipment in the demo Home Record. It is competent
and it is not yours. Until you have been through a quarter, its screen says
so, and so does the tab.

The draft lives in `lib/checklist-templates.ts` and is the fallback for any
quarter nobody has set up — so a fresh install still schedules a usable
visit on day one.

---

## A few items worth keeping

Not instructions — just the ones that earn their place and are easy to drop
by accident:

- **Exercise the main water shutoff** (Q1). A valve that never moves seizes,
  and a seized valve snaps when somebody finally needs it. This is the
  difference between a leak and a flood.
- **Read the date stamp on the smoke and CO alarms** (Q1). They expire —
  ten years for smoke, seven to ten for CO. An expired alarm still beeps
  when you test it, which is exactly the problem.
- **Garage door auto-reverse on a 2x4** (Q3). Two minutes, and it is the one
  that matters.
- **Disconnect the hoses** (Q4). A hose left on a frost-free sillcock
  defeats it completely, and it is the commonest burst pipe there is.
- **Radon** (Q1). Lancaster County is a high-radon area and winter — house
  shut up — is the right time to test.

---

## Core items — the ones on every visit

Tick **"Check this on every visit"** and an item leaves the seasons
behind. It goes on all four quarters, it is written once, and editing it
once changes all four.

That is where the whole Life Safety, Water Leaks, Moisture, Electrical,
Plumbing, HVAC, Water Heater, Basement, Exterior and Garage sections live —
197 items that never rotate out, because fire and water do not wait for the
right quarter.

Internally the core list is parked on whichever quarter was set up first.
That is bookkeeping; it makes no difference to what a visit shows.

---

## Items that record a number

Fill in a **unit** on an item and the technician gets a number box instead
of a tick. Fill in the healthy range too and anything outside it highlights
on their screen — a prompt to look harder, never an automatic failure.

Fifteen items do this as shipped: A/C temperature split, furnace
temperature rise, flue CO, ambient CO, water pressure, three humidity
readings, moisture meter, radon manometer, compressor amps, propane level,
attic insulation depth and the widest marked foundation crack.

**This is the part no home inspector can do.** They see a house once. The
reading goes on the member's report in a *What we measured* table with its
healthy range, and next year's report sits beside it. "Your temperature
split has gone from 18° to 13° over two years" is a sentence only a
quarterly membership can write.

---

## The six results

A technician picks one per item. Each names the action rather than the
severity, because "Repair recommended" tells a member what happens next in
a way "Fail" never did.

| | Means |
|---|---|
| **Good** | No action needed |
| **Maintenance** | Routine work recommended |
| **Monitor** | Not failing yet — track it |
| **Repair** | Plan the repair |
| **Urgent** | Safety — address now |
| **Specialist** | Needs the right trade |

Plus **N/A** for anything not on this house.

These are *not* the finding statuses. A checklist result is what a
technician saw at one item; a finding is what B&M has decided to tell the
member about it. GOOD / MONITOR / PLAN / ACTION / IMPROVEMENT is untouched.

Visits done before this change still read correctly — the old "Watch" and
"Fail" render as they always did, they just cannot be chosen any more.

---

## Three hundred items on a phone

A visit is 240–320 items depending on the house. That works because of one
button.

Open a section, mark what is wrong, then tap **"Rest all good — N items"**.
Everything still untouched in that section becomes Good. It only ever
touches untouched items, so it can never overwrite a judgement somebody
already made.

Sections are collapsed by default and the header carries the whole story —
how many items, how many left, how many flagged — so the list is scannable
closed.

The tapping is not the work. A genuine 300-point inspection is a two to
four hour visit; the app should never be the reason it takes longer.

---

## Where the items came from, and what is still missing

`docs/inspection-standard.md` is the research behind the lists: what
Pennsylvania actually requires of a home inspector, what their standard
deliberately leaves out, and what is specific to this county — radon, karst
limestone, unregulated private wells, old housing stock.

It ends with a longer list of preventative maintenance items than the app
currently carries, marking which are already in the draft and which are not.
Work through it when you mark up a quarter.

The biggest gap it identifies is not a missing item. It is that almost every
item is pass/fail when about eight of them should **record a number** — A/C
temperature split, flue CO in ppm, water pressure in psi, humidity, and so
on. A number you can compare to last year is the one thing no home inspector
can ever give a homeowner, and it is the argument for the membership.

---

## Where it lives

| What | Where |
|---|---|
| The editor | `app/admin/checklists/`, `components/admin/checklist-editor.tsx` |
| Saving edits | `lib/actions/checklists.ts` |
| Loading a list (database, then draft) | `lib/checklists.ts` |
| The built-in draft, and the house-matching rule | `lib/checklist-templates.ts` |
| Tables and RLS | `supabase/migrations/0018_checklist_templates.sql` |
| Test of the house-matching | `tests/checklists.test.mjs` (`npm test`) |
