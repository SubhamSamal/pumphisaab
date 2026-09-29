# Go-live trial plan: managers use the app beside the notebooks

> The owner's tick-box version of this plan: `docs/plans/START-HERE-owner-checklist.md`.

Status: **plan written 29 Sep 2026; owner answers D92-D95; waiting for "go"**
Replaces the order in EXECUTION.md: Phase 5's parallel run starts now, before the rest of Phase 5 and Phase 6 are built. New work reaches phones over the air.

## Goal
From the day after clean-up, the managers type every day into the **PumpHisaab** app while the notebook continues. Each evening the owner compares app and notebook; differences come to Claude; fixes go out over the air.

## Owner answers (29 Sep 2026)
- **D92** Go live now beside the notebooks (parallel run brought forward).
- **D93** Backups: a free nightly copy for now (Supabase free plan); Supabase Pro when the data grows. Every save is already stored the moment it's made; the nightly copy is the safety net.
- **D94** Two apps: managers (and the owner, for real days) use the **production** app `com.pumphisaab.app`; the owner also keeps **PumpHisaab Preview**, which gets every change first. The old development app is replaced by the production app (not needed any more: updates come over the air).
- **D95** 1-2 managers, all Android: the install link goes on WhatsApp.

## Order
### A. End-to-end test (owner, ~1 hour) — the Phase 4 exit check
Migration 13 pasted (ledger = 13); 27 Sep submitted; the 15 Sep notebook numbers typed into 28 Sep with a stopwatch (steps and expected totals: `docs/plans/phase-4-owner-steps.md`, Step 4). Anything wrong is fixed over the air before managers start.

### B. Nightly backup (Claude builds, owner adds 2 secrets)
- A GitHub Actions job runs every night at 02:00 IST (and on demand): it copies the whole database (the Supabase roles, the tables' structure and all data, including logins) with the Supabase CLI.
- The repo is **public**, so the copy is **encrypted** (a passphrase only the owner keeps) before it's stored as a GitHub artifact, kept 30 days. Without the passphrase it's unreadable.
- **Restore is tested for real:** a second job, run by hand, takes the latest copy, decrypts it, loads it into a throwaway Supabase (like the CI database check) and counts the days, readings and slips. Run once now and then monthly.
- Owner steps: add two GitHub secrets (click by click): `SUPABASE_DB_URL` (the database connection address with its password, from Supabase › Connect) and `BACKUP_PASSPHRASE` (a long phrase you write down and keep safe; losing it makes the copies useless).
- If a night fails, GitHub emails the owner.

### C. Clean-up (owner pastes, after the first good backup)
`supabase/cleanup/remove-test-days.sql` (D80): removes every test day and the `manager.test` link; the pilot starts on the next business day. Then delete the `manager.test` user in Supabase › Authentication.

### D. Production app (Claude builds, ~20 minutes)
- `eas build --profile production` (Android ID `com.pumphisaab.app`, name PumpHisaab, channel `production`); crash reports on.
- The owner installs it (it replaces the old development app; sign in again).
- From then on: every fix goes to `preview` first → the owner checks on PumpHisaab Preview → the same update is sent to `production`.

### E. Set up for real use (owner, in the production app, ~20 minutes)
Profile › Logins: one login per manager (username + password to give them). Profile › Staff: every attendant. Check today's prices (and diesel margin). Companies get added as slips come.

### F. Managers start
- Claude writes a one-page **Manager guide** (plain English, big steps): install from the link, sign in, the day in order (price → opening dip → tanker → shifts → sales → expenses → closing dip → Review → Submit), what red/yellow/green mean, what to do when offline.
- The owner sends the link and the guide on WhatsApp and sits with each manager for the first day.

### G. Daily loop (the parallel run)
- Managers fill the day in the app; the notebook continues as before.
- Evening: the owner compares the app's Review with the notebook; any difference → a screenshot to Claude.
- Claude fixes → over the air to Preview → owner checks → production. Database changes still come as migrations the owner pastes first.

## What needs a reinstall later (can't go over the air)
New phone-side features: **push notifications** (Phase 5) and possibly PostHog (Phase 6). Managers reinstall once from a new link then (2 minutes). Everything else (screens, maths, checks, bell, flags, owner notes, settings, dashboard) comes over the air.

## Then
Phase 5 (flags stored and sent, bell, unlock request, owner notes, push) and Phase 6 (settings screens, dashboard) are built during the parallel run, each with its plan → MCQs → "go", delivered over the air.
