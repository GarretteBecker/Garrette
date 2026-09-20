# Connecting GoHighLevel

HomeKeeper does not send texts or emails. It tells GHL that something
happened, and a GHL workflow decides what to say. That split is deliberate:
you already pay for GHL and already know how to write messages in it.

---

## First: the API key question

You asked how to get your GHL API key. Worth knowing before you go hunting
for it — **for what you want here, you probably do not need one.**

There are two ways to connect the two systems:

| | **Inbound webhook** (what this uses) | **API key** |
|---|---|---|
| What it is | A URL GHL gives you. HomeKeeper posts to it. | A token letting HomeKeeper call into GHL. |
| Setup | About 3 minutes | More involved |
| Good for | "Something happened — go message them" | Reading and writing GHL records directly |
| Risk if leaked | Someone could trigger your workflow | Someone could read and change your CRM |

Since what you want is "text the member when their report is ready", the
webhook is the right tool and the lower-risk one. **Both are covered below**
— webhook first, API key after, in case you want it later.

---

## Part 1 — Get the webhook URL (3 minutes)

1. Log in to GoHighLevel and pick the right **sub-account / location** — not
   the agency view. Messages go out from a location.
2. Left sidebar → **Automation** → **Workflows**.
3. **+ Create Workflow** → **Start from Scratch**.
4. Name it something you will recognise: `HomeKeeper — Report Released`.
5. Click **Add New Trigger** → search for and choose **Inbound Webhook**.
6. GHL shows you a **Webhook URL**. **Copy it.** That is the whole secret.
7. Click **Save**, then toggle the workflow **Publish** on, top right.

> **A draft workflow silently ignores everything sent to it.** If events seem
> to vanish, check that toggle first.

## Part 2 — Tell HomeKeeper about it

Add to `.env.local` (and to Vercel's Environment Variables — see
`docs/deploy-vercel.md`):

```
GHL_WEBHOOK_URL=https://services.leadconnectorhq.com/hooks/......
GHL_WEBHOOK_SECRET=make-up-a-long-random-string-here
```

`GHL_WEBHOOK_SECRET` is optional and invented by you. HomeKeeper sends it as
a header so your workflow can confirm a post really came from HomeKeeper.

**Leave `GHL_WEBHOOK_URL` blank and the whole integration is simply off.**
Nothing breaks, nothing is sent.

## Part 3 — See the data, then build the message

GHL can only offer you merge fields it has actually seen.

1. With the workflow published, do the thing in HomeKeeper that fires it —
   release a report, say.
2. Back in GHL, open the trigger. Under **Sample Payload** or
   **Recent Executions** you will see what arrived.
3. Now add an **Action** → **Send SMS** or **Send Email**, and pull in the
   fields.

A text that reads well:

> Hi {{contact.first_name}}, your {{inboundWebhookRequest.data.report_title}}
> from B&M is ready. — B&M Home Improvement Solutions

---

## What HomeKeeper sends, and when

Three events. Each is a POST of JSON.

### 1. `report.released` — you release a report to a member

```json
{
  "event": "report.released",
  "occurred_at": "2026-09-20T18:30:00.000Z",
  "source": "bm-homekeeper",
  "contact": {
    "first_name": "Sarah", "last_name": "Miller",
    "email": "sarah@example.com", "phone": "(717) 555-0103"
  },
  "property": { "id": "…", "name": "The Miller Home", "address": "123 Maple Ave, Lancaster, PA 17601" },
  "data": {
    "report_id": "…",
    "report_title": "Q3 2026 HomeKeeper Report",
    "report_type": "VISIT_SUMMARY",
    "period_start": "2026-07-01",
    "period_end": "2026-09-30",
    "report_path": "/reports/…"
  }
}
```

> `report_path` is a path, not a full link. Put your domain in front of it in
> the GHL template: `https://app.yourdomain.com{{...report_path}}`.

### 2. `service_request.stage_changed` — a request moves

Fires on **every** stage change, including when a member first submits one.

```json
{
  "event": "service_request.stage_changed",
  "data": {
    "request_id": "…",
    "request_title": "Kitchen disposal humming but not spinning",
    "from_stage": "Triage",
    "to_stage": "Scheduled",
    "member_status": "Scheduled",
    "member_message": "Booked in. You will see the date and time here.",
    "waiting_on": "B&M",
    "scheduled_for": "2026-10-02T08:00:00.000Z"
  }
}
```

The three fields worth knowing:

- **`member_status`** — the stage in homeowner language ("Waiting on you"
  rather than `AWAITING_APPROVAL`).
- **`member_message`** — a ready-written plain-English sentence. You can send
  this as the whole text body and it will read properly.
- **`waiting_on`** — `B&M`, `Trade`, or `You`. Useful for a filter: only text
  the member when the ball is in *their* court, so you are not pinging them
  about internal steps.

> **Start with a filter.** Twelve stages means up to twelve messages per job.
> Most members want two: "we've got it" and "you need to approve this". In
> the workflow, add an **If/Else** on `to_stage` and only message on the ones
> that matter.

### 3. `visit.scheduled` — you book a visit

```json
{
  "event": "visit.scheduled",
  "data": {
    "visit_id": "…",
    "visit_title": "Q4 Fall Visit",
    "visit_type": "SEASONAL",
    "scheduled_for": "2026-10-13T13:00:00.000Z",
    "scheduled_for_readable": "Monday, October 13 at 1:00 PM"
  }
}
```

Use `scheduled_for_readable` in messages — it is already written the way you
would say it out loud.

---

## One workflow or three?

Both work — pick whichever you find easier to maintain.

**A workflow per event (recommended).** Build a separate workflow per event,
each with its own Inbound Webhook trigger, and set one variable per URL:

```
GHL_WEBHOOK_URL_REPORT_RELEASED=https://services.leadconnectorhq.com/hooks/...
GHL_WEBHOOK_URL_REQUEST_STAGE=https://services.leadconnectorhq.com/hooks/...
GHL_WEBHOOK_URL_VISIT_SCHEDULED=https://services.leadconnectorhq.com/hooks/...
GHL_WEBHOOK_URL_RENEWAL_NOTICE=https://services.leadconnectorhq.com/hooks/...
GHL_WEBHOOK_URL_MEMBERSHIP_RESCINDED=https://services.leadconnectorhq.com/hooks/...
```

Each workflow then has one trigger and one message, with no branching.

The last two are the compliance events:

- **`membership.renewal_notice`** fires when you press *Send the reminder* on
  the compliance desk. Its `member_message` field is the renewal disclosure,
  already written — drop it straight into the email or text. This is the one
  workflow worth building first: it is a notice with a deadline on it, and
  the app records the date it went.
- **`membership.rescinded`** fires the moment a member cancels inside their
  three-business-day window. Point this one at *yourself*, not the member —
  it is the office that needs to know today.

**One workflow.** Set only `GHL_WEBHOOK_URL` and every event goes there; add
an **If/Else** on the `event` field at the top and branch into a path each.

**Mixing is fine.** A per-event URL wins where it is set, and
`GHL_WEBHOOK_URL` catches everything else — so you can split one event out
without touching the others.

---

## Getting an API key (only if you need one later)

You would want this for *reading* or *writing* GHL records — creating a
contact from HomeKeeper, pulling a pipeline value. Nothing in HomeKeeper uses
it today.

1. In GHL, go to **Settings** (bottom left) → **Private Integrations**.
2. **+ New Private Integration**.
3. Name it `HomeKeeper`.
4. Tick only the scopes you actually need — `contacts.readonly` and
   `contacts.write` cover most things. Do not tick everything.
5. **Create**, then **copy the token immediately**. GHL shows it once.
6. Store it in a password manager.

> The older "API Key" under Settings → Business Info is the deprecated v1
> key. Use a Private Integration token instead.

**This token can read and change your CRM.** It belongs in a password manager
and in Vercel's environment variables — never in a text message, never in a
chat, never committed to GitHub. If it ever leaks, delete the integration in
GHL and make a new one; that instantly kills the old token.

---

## When it is not working

Run through these in order:

1. **Is the workflow published?** A draft accepts nothing. Most common cause.
2. **Is `GHL_WEBHOOK_URL` set where the app is actually running?** Setting it
   in `.env.local` does nothing for the live site — it has to be in Vercel's
   Environment Variables, and you must redeploy after adding it.
3. **Right sub-account?** An agency-level webhook will not message a contact
   in a location.
4. **Check GHL's own log** — the trigger's **Recent Executions** shows what
   arrived and what the workflow did with it.
5. **Check Vercel's log** — project → **Logs**. HomeKeeper writes a line
   starting `[ghl]` whenever a send fails.

A failed send **never breaks HomeKeeper**. If GHL is down, the report still
releases and the request still moves; only the message is lost. That is on
purpose — the record of work matters more than the notification.
