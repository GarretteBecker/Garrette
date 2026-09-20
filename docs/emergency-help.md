# "I need help now" — how it works, and the rules it follows

This is the safety-critical part of HomeKeeper. Read this before changing a
word of `lib/emergency.ts`.

---

## What it is

A red button at the top of the member's dashboard. They tap it, pick what is
happening, and get told what to do — **in their own house**. Not a generic
article: their shutoff, in their basement, with the photograph your
technician took of it.

That last part is the whole product. Anyone can publish "turn off your water
at the main". Only you can say *"yours is the red lever on the northwest wall
just past the stairs"* and show them a picture of it.

---

## The three rules

Everything in this feature follows these. They are not style preferences.

### 1. Life before property

Where there is any chance of fire, explosion or carbon monoxide, the first
instruction is **leave and call 911** — never "go and find your shutoff".

The clearest case is a gas leak. Sending somebody into a gassy basement to
hunt for a valve is the worst thing this app could do to a member, so the
gas screen:

- opens with a full-width red **Get everyone out now** card and a 911 button,
  above everything else
- **never** shows the gas shutoff location
- explicitly says *"do not go looking for the gas shutoff inside the house"*
  and *"do not switch anything on or off — a light switch can make a spark"*

The electrical screen works the same way: fire or smoke → out and 911, and
the breaker step is conditioned on the panel being dry and reachable.

The ordering of the list on the picker screen is also part of this. "I smell
gas" and "Burning smell, smoke or sparks" are first, because a frightened
person taps the first thing that matches, and burying them under "no hot
water" would make the ordering itself a hazard.

### 2. We are not the emergency services

Every screen says so, and every screen has a 911 button. B&M is who you call
once you are safe, not instead of 911.

### 3. Never invent their house

If a shutoff has not been recorded, the screen says **"We have not recorded
your main water shutoff yet"** and tells them to call. It does not guess, and
it does not show a stock photograph of somebody else's valve.

Showing nothing would be worse than an honest gap — it would read as though
the step simply did not apply to them.

---

## Phone numbers are never hard-coded

⚠ **There is no phone number written into this code except 911.**

A utility's emergency number varies by address and changes over time, and a
wrong number on a gas-leak screen is the worst possible bug in this app. So
utility numbers come from environment variables, have **no defaults**, and
simply do not render when unset — the step still tells the member where to
find it (their bill).

Set these once you have checked them against a real bill for your area:

```
NEXT_PUBLIC_GAS_UTILITY_NAME=
NEXT_PUBLIC_GAS_UTILITY_PHONE=
NEXT_PUBLIC_ELECTRIC_UTILITY_NAME=
NEXT_PUBLIC_ELECTRIC_UTILITY_PHONE=
NEXT_PUBLIC_WATER_UTILITY_NAME=
NEXT_PUBLIC_WATER_UTILITY_PHONE=
NEXT_PUBLIC_BM_EMERGENCY_PHONE=
```

They are `NEXT_PUBLIC_` on purpose: an emergency number is meant to be read
by the person holding the phone.

**Until `NEXT_PUBLIC_BM_EMERGENCY_PHONE` is set, there is no "Call B&M"
button** — only "Log it with photos". Setting it is the single highest-value
thing you can do to this feature.

---

## It is not tier-gated, and that is deliberate

`urgent_help` is a Response feature in `lib/membership.ts`, but the emergency
screen and the shutoff information are available to **every member on every
tier**.

Withholding *"here is where your water shutoff is"* from a paying member
because they are on the cheaper plan is not a business model. It is a
liability, and it is the kind of decision that ends up in a deposition.

What the tier gates is the **response**, which is the thing you are actually
selling:

- **Response** — *"Tell us and it goes to the top of our list — your plan
  includes priority response."*
- **Core** — *"Tell us and we will come back to you as soon as we can during
  business hours."*

That is honest in both directions and still worth paying for. If you want it
changed, it is one function (`responsePromise`) and one RLS policy.

---

## What the office has to do

The feature is only as good as the data behind it. On each property's
**Overview** tab there are now two cards:

**About the house** — water source, sewer type, heating fuel, electrical
service size, construction, roof. Water and sewer change the advice: a well
home loses water pressure when the power goes out and a public home does
not; a septic backup often means a full tank rather than a blockage.

**Shutoffs & access points** — this is the one that matters. For each, record
where it is, how to work it, and **take the photograph**. The six the
emergency screens ask for are:

| Point | Used by |
|---|---|
| Main water shutoff | Water leak, no water, appliance leak |
| Main electrical panel | Electrical, no heat, no hot water, basement water, roof leak |
| Water heater shutoff | Water leak, no hot water |
| Sump pump | Basement water |
| Main drain cleanout | Sewage backup |
| Main gas shutoff | Recorded for reference — deliberately never shown during a gas emergency |

The card tells you which are still missing. Capture them on the baseline
visit; it takes about ten minutes with the camera already in the app.

**Write the location note for somebody frightened, in the dark, who has never
looked for it before.** Not "basement NW" — *"Basement, northwest corner, on
the wall just past the stairs where the line comes in through the
foundation."*

---

## Privacy — CLAUDE.md rule 3 still holds

There is deliberately **no field** for an alarm code, a gate code, a key
location or a safe combination, and none has been added here.

A shutoff location is not a security credential — it is a valve that anyone
standing in the room can see. A key location is, so it stays out.

---

## Where it lives

| What | Where |
|---|---|
| Emergency content, steps, "do not" lists | `lib/emergency.ts` |
| Utility numbers from config | `lib/emergency-contacts.ts` |
| The picker | `components/member/emergency-picker.tsx` |
| The guidance screen | `components/member/emergency-guide.tsx` |
| Loading their shutoffs, with signed photos | `lib/member/safety.ts` |
| Recording shutoffs | `components/admin/safety-points.tsx` |
| Table, RLS, cross-property guard | `supabase/migrations/0013_home_facts_and_safety.sql` |

---

## What is not built

- **No triage.** Every emergency shows the same guidance to everyone. It does
  not ask follow-up questions or branch.
- **No notification to you.** Tapping "Log it with photos" raises an urgent
  service request, which fires the existing GoHighLevel stage event. There is
  no separate paging or on-call rota.
- **No offline copy.** The emergency screens are authenticated pages, and the
  service worker deliberately never caches those (a cached Home Record served
  to the wrong person is exactly what CLAUDE.md rule 2 exists to prevent).
  **A member with no signal cannot open this screen.** Worth solving — a
  printed card on the fridge with their shutoff photo would cover the gap
  today, and is a good baseline-visit leave-behind regardless.
- **The content has not been reviewed by a licensed plumber, electrician or
  HVAC contractor.** It is general homeowner guidance of the kind a utility
  prints on a fridge magnet. You are a licensed contractor — read every word
  of `lib/emergency.ts` and correct anything you would not say to a customer
  yourself.
