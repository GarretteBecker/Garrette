# Assumptions I had to make — please mark these up

`CLAUDE.md` says:

> Full product spec: docs/homekeeper-spec.md — read it before any major feature.

**That file does not exist in this repository.** I checked at the start of
every phase. Rather than stop and build nothing, I built from the detail that
*is* in `CLAUDE.md` (the 13 data objects, 4 roles, 5 finding statuses, 12
service-request stages, brand colors, and the 7 non-negotiable rules) and
invented the rest.

Everything on this list is a guess I made. Some of it is probably wrong. None
of it is hard to change — but the longer it sits unreviewed, the more code
gets built on top of it.

---

## 1. The Q1–Q4 seasonal checklists — **biggest guess**

**File:** `lib/checklist-templates.ts`

You asked for "the seasonal checklist (Q1–Q4 from the spec)". With no spec, I
wrote four checklists from standard Mid-Atlantic home maintenance practice and
from the equipment actually in the Miller Home demo record:

- **Q1 Winter** (Jan–Mar), 14 items — heating under load, freeze risk, safety
- **Q2 Spring** (Apr–Jun), 16 items — A/C start-up, water management, envelope
- **Q3 Summer** (Jul–Sep), 13 items — cooling under load, moisture, pests
- **Q4 Fall** (Oct–Dec), 16 items — heating prep, winterisation

**This is the one to review first.** It's what your tech reads off the phone at
every single visit, so if the items are wrong or in the wrong order, that's
wrong a hundred times a year. Everything reads from that one file, so
rewriting the lists changes the whole app with no other edits.

## 2. Report structure

You listed eight sections and I built them in that order. What I invented:

- Section numbering (01–08) and the cover page layout
- "The one thing to know" picks the headline finding automatically —
  whichever finding you've flagged as headline, else the first ACTION, else
  the first PLAN. You can override it per report.
- The Home Plan section totals the low and high estimates into a range
- IMPROVEMENT findings are pulled out of the main findings list into their
  own "Worth considering" section at the end, so the report doesn't read as
  all problems

## 3. Service request stages

Stored in the database with underscores (`AWAITING_APPROVAL`) because Postgres
enum labels with spaces are painful. Displayed with spaces, exactly as your
brief writes them. No behaviour is attached to the stages yet — nothing
enforces the order or auto-advances anything. That's a later phase.

## 4. Who can do what

`CLAUDE.md` defines the four roles but not the exact permissions, so:

| | admin | tech | member | trade |
|---|---|---|---|---|
| See a property | all | assigned only | own only | — |
| Edit Home Record | ✅ | assigned only | ❌ | ❌ |
| Log findings | ✅ | assigned only | ❌ | ❌ |
| Delete anything | ✅ | ❌ | ❌ | ❌ |
| Raise a service request | ✅ | ✅ | own property | ❌ |
| See a draft report | ✅ | ✅ | ❌ | ❌ |

Two calls worth challenging: **techs can't delete** anything (so field history
can't be erased), and **members are read-only** apart from raising a request.

## 5. Things in the schema you didn't ask for

- `property_techs` — had to exist, or "tech sees assigned properties only" has
  no way to be true
- `service_request_events` — stage history, so the pipeline is auditable
- `reports.status` (DRAFT/IN_REVIEW/RELEASED) — you asked for admin review
  before release, this is how

## 6. Demo data invented wholesale

Everything about the Miller Home beyond what you specified: the Millers'
names, the 36 assets and their model and serial numbers, both visit
write-ups, all 12 findings, the Home Plan, both service requests, and the four
trade partners. It reads realistically, but every number in it is fiction.

## 7. PDF generation — **known gap, flagged**

`CLAUDE.md` says "PDF reports generated server-side." What's built is a
server-rendered report page with proper print CSS, and a **Save as PDF**
button that uses the browser's print dialog.

The output is genuinely good — US Letter, correct margins, brand colors
preserved, sections kept from splitting across pages. But it is not the same
thing as a PDF generated on the server, which is what you'd need to email a
report automatically or attach one to a GoHighLevel workflow without a human
pressing a button.

Closing that gap means headless Chrome on the server (Puppeteer). It's a
contained piece of work and the report page is already built to be its input.
I didn't do it because you'd be paying for it in every deploy, and I'd rather
you decide that.

---

## What I'd most like corrected

1. **The Q1–Q4 checklists** — highest impact, used every visit
2. **The permission table** — especially "techs can't delete"
3. **Whether the report sections are in the order you'd present them** to a
   homeowner sitting at their kitchen table
