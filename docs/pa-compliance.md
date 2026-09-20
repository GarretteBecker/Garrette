# Pennsylvania compliance — what the app does, and what it does not

**Read this before you sign anyone up.**

I am not a lawyer and this is not legal advice. What follows is an honest
account of what I built, what I was able to verify, and what a Pennsylvania
attorney still has to settle. The app now has the *machinery* for these
requirements. It does not have a lawyer's sign-off on the *wording*, and no
amount of code substitutes for that.

---

## The short version

| Requirement | Verified? | Built? |
|---|---|---|
| Three-business-day right to cancel | **Yes** — PA HICPA | Yes, as a working button |
| Agreement stored and readable by the member | n/a (good practice) | Yes |
| Auto-renewal disclosure | Partly — see below | Yes |
| How to opt out of renewal | n/a (good practice) | Yes |
| Renewal notice 10–20 days before | **No — could not confirm** | Yes, window configurable |

---

## 1. The three-business-day right to cancel — verified

Pennsylvania's **Home Improvement Consumer Protection Act** (HICPA,
73 P.S. § 517.1 et seq.) gives a homeowner **three business days from
signing** to rescind a home improvement contract, requires the contract to
*say so*, and makes a non-conforming contract **unenforceable against the
homeowner**. B&M is a registered PA home improvement contractor
(PA Lic. #154223), so this one is not optional.

**What the app does**

- Every agreement stores a `rescission_deadline`, set **by the database**
  from the signing date — not typed in by whoever filled in the form. A
  statutory deadline that depends on someone's mental arithmetic on a Friday
  afternoon is not a deadline.
- While the window is open, the member's Membership screen leads with a
  countdown and a real **Cancel my membership** button.
- Cancelling goes through one narrow `SECURITY DEFINER` function that
  re-checks the caller, the property and the date. Tested: it refuses a
  member whose window has closed, a member from another property, an admin
  and a technician.
- The right is stated on the screen whether or not it is still open, so the
  member finds the same sentence later that they signed.

**⚠ What a lawyer must settle**

1. **Is a HomeKeeper membership a "home improvement contract" under HICPA?**
   It is a recurring maintenance and coordination service, not a remodel. It
   may fall under HICPA, under a different consumer statute, or under none.
   I could not answer this and did not try. The app gives the right
   **either way**, which is the safe direction to be wrong in — but the
   contract wording depends on the answer.
2. **HICPA has other contract requirements** that live in your paperwork,
   not in this app: your registration number, the total price, a description
   of the work, estimated start and completion dates, the deposit, the
   Attorney General's Bureau of Consumer Protection toll-free number, and the
   cancellation notice itself. Sources below say a contract missing these is
   unenforceable against the homeowner. **Check your membership agreement
   against that list.**
3. **Insurance minimums** (liability and property damage) are a HICPA
   condition of registration, nothing to do with this app.

### Known limitation: holidays

`public.add_business_days()` skips **weekends only**. Pennsylvania legal
holidays are deliberately not modelled, because doing it subtly wrong is
worse than not claiming it at all.

The effect is always in the member's favour: where a holiday falls inside the
window, the real deadline is *later* than the one the app shows, so a member
who cancels by the displayed date is always in time. If you want holidays
handled exactly, it needs a maintained holiday table — say the word.

---

## 2. The renewal notice — NOT verified

**Your Master Program Specification asks for a notice 10–20 days before
renewal. I could not confirm that this is currently required by Pennsylvania
law.**

What I found:

- Pennsylvania's existing automatic-renewal statute appears to be **narrow**,
  aimed at health clubs and similar contracts, rather than a general
  consumer auto-renewal law.
- Broader bills have been introduced (HB 45 in 2025, HB 2196 earlier) that
  would require disclosure of renewal terms, advance notice, and retention of
  proof of notice — but introduced is not enacted.
- There is a separate rule that when a business is sold, the new owner must
  notify consumers within 60 days and let them opt out of auto-renewal.

So the 10–20 day window in the spec may come from another state's law, from
a draft bill, or from the spec author's own judgement. **Ask your attorney
where it came from.**

**What the app does anyway**

- The window is stored **per agreement** (`renewal_notice_days_before_max`
  and `_min`, defaulting to 20 and 10), so counsel can change it without a
  code change.
- `/admin/compliance` lists who is due, and separately who is **late**. A
  late notice is the thing you most need to see, so it stays on the list
  rather than quietly dropping off.
- Sending the reminder records the date, the method (email, post, text, in
  person) and who sent it — and fires a GoHighLevel event so the message
  itself goes out of GHL. Proof of notice is a requirement in the proposed
  bills, and it is worth having regardless.

**My view, for what it is worth:** send it anyway. A member surprised by a
renewal charge is a member lost and a chargeback opened, whatever the statute
says. The cost of sending is an email.

---

## 3. Auto-renewal disclosure and opt-out

Built, wording unreviewed. The member's Membership screen states in plain
English that it renews, the date, the price, and how to stop it — generated
in `lib/agreements.ts` (`autoRenewalDisclosure`, `OPT_OUT_INSTRUCTIONS`).

Opting out is deliberately not a hoop: any service request, email or phone
call before the renewal date counts, and you confirm it in writing.

**⚠ Have counsel read those two functions.** They are four sentences and they
are the sentences a regulator would read first.

---

## 4. What is NOT built

- **No signup flow.** There is no self-serve join, so there is no place to
  present the disclosures *before* someone commits. Today an agreement is
  recorded by the office after a paper or GHL signing. If you later add
  online signup, the disclosures and the cancellation notice must appear
  **before** the payment step, not after.
- **No e-signature.** The app stores the signed document you upload; it does
  not capture the signature.
- **No holiday calendar** (see above).
- **No retention policy.** Agreements are kept indefinitely. If counsel
  specifies a retention period, that is a change to make.

---

## 5. Where it lives in the code

| What | Where |
|---|---|
| Table, deadline trigger, cancellation function, notice view | `supabase/migrations/0012_membership_agreements.sql` |
| Dates, windows and the member-facing wording | `lib/agreements.ts` |
| The member's screen | `components/member/agreement-panel.tsx` |
| Recording an agreement | `components/admin/agreement-editor.tsx` |
| The compliance desk | `app/admin/compliance/page.tsx` |
| Sending and logging the notice | `lib/actions/agreements.ts` |

---

## Sources

Verified against these on 20 September 2026. Neither is a substitute for
counsel, and one primary source below is the statute itself.

- [Home Improvement Consumer Protection Act, 73 P.S. § 517.1 et seq. — PA Attorney General](https://www.attorneygeneral.gov/wp-content/uploads/2018/01/Act_132_Home_Improvement.pdf)
- [Pennsylvania Home Improvement Consumer Protection Act: What Residential Contractors Need to Know — Levelset](https://www.levelset.com/blog/pennsylvania-home-improvement-consumer-protection-act/)
- [Three-Day Right to Cancel in Pennsylvania — Craftsman Book Company](https://craftsman-book.com/articles/three-day-right-to-cancel-in-pennsylvania/)
- [Auto-Renewal Laws: 2025 Round Up — Kelley Drye & Warren LLP](https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/auto-renewal-laws-2025-round-up)
- [Automatic Renewal Restrictions: A Reminder to Send Reminders — McNees Wallace & Nurick LLC](https://www.mcneeslaw.com/automatic-renewal-restrictions-a-reminder-to-send-reminders/)
- [PA House Bill 45 (2025), automatic renewals — PA General Assembly](https://www.palegis.us/legislation/bills/text/PDF/2025/0/HB0045/PN0024)

A 50-state automatic-renewal chart I tried to check (Mayer Brown) is blocked
by this environment's network, so I could not read the Pennsylvania row
directly. That is part of why item 2 above is marked unverified rather than
disproved.
