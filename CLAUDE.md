# B&M HomeKeeper — Project Brief

## What this is
A managed-home membership platform for B&M Home Improvement Solutions LLC (veteran-owned remodeler, Columbia PA, PA Lic. #154223). Full product spec: docs/homekeeper-spec.md — read it before any major feature.

## Users & roles
- admin: B&M office/owner. Sees everything.
- tech: B&M field technician. Sees assigned properties/visits only. Captures checklists, findings, photos, assets.
- member: homeowner. Sees ONLY their own property. Views Home Record, reports, plan; submits service requests.
- trade (later phase): sees only jobs dispatched to them.

## Stack (do not change without asking)
- Next.js (App Router) + TypeScript + Tailwind
- Supabase: Postgres, Auth, Storage (photos/docs), Row Level Security on EVERY table
- Deployed on Vercel; installable PWA (mobile-first)
- PDF reports generated server-side
- GoHighLevel integration via webhooks/API (later phase) — GHL handles billing, SMS/email marketing

## Core data objects
property, member, room, asset, visit, checklist_item, finding, service_request, trade_partner, document, plan_item, report, photo

## Finding status system (exact labels + colors)
GOOD (green), MONITOR (blue), PLAN (amber), ACTION (red), IMPROVEMENT (purple)

## Service request stages
NEW → TRIAGE → DISPATCHED → ACCEPTED → ESTIMATING → AWAITING APPROVAL → APPROVED → SCHEDULED → IN PROGRESS → COMPLETED → HOME RECORD UPDATED → CLOSED

## Brand
Navy #1B2A4A, green #2E5E3A, white. Clean, premium, trustworthy. Tagline: "One number for your home." Footer: B&M Home Improvement Solutions LLC • PA Lic. #154223

## Non-negotiable rules
1. Field app speed is the top priority: logging a finding with photo must take under 30 seconds, one-handed on a phone.
2. Members can never see another property's data. Enforce with RLS, not just UI.
3. Never store alarm codes, passwords, safe combinations, or payment card data.
4. Compress photos on upload.
5. Build one phase at a time. After each phase: run it, test it, summarize what was built, list what I should test on my phone, and commit to git.
6. Explain things to me in plain English — I'm a contractor, not a developer.
7. Keep a CHANGELOG.md updated.
