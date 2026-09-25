# PumpHisaab: Execution Plan

This file is context for Claude Code. Read it after CLAUDE.md and the PRD. It has the full phase plan, what is done so far, and what Phase 0 still needs. **Verify the "Status" section against the real repo and environment before trusting it** — it was last updated by hand and may be stale.

---

## Status snapshot (last updated 25 Sep 2026)

### Done
- [x] Brand: PumpHisaab, tagline "Sara hisaab ek jagah", domain pumphisaab.com bought
- [x] PRD v1.1 written: `docs/PRD-PumpHisaab-v1.1.md` (plus canvas additions in `docs/decisions.md` D3)
- [x] CLAUDE.md written (repo root)
- [x] Design system built in Claude Design (colour, type, spacing, all components)
- [x] Design flow canvas built in Claude Design (full screen flows, static)
- [x] GitHub repo created: https://github.com/SubhamSamal/pumphisaab.git
- [x] Supabase project created — **single project, production data from day one, no staging**: `pumphisaab`, Mumbai region
- [x] Dip chart digitised and cleaned: `docs/data/DipChart_20KL_MS1_HSD1.xlsx` (0-210cm, full tank = 21,628.93 L, not the nominal 20,000 L)
- [x] Decision: skip Play Store for the pilot; direct-install APK via EAS Build (protects the owner's other venture's Play developer account, which was being considered for reuse)
- [x] Decision: Cloudflare Pages for web hosting, not Vercel (Vercel's free tier is non-commercial only)
- [x] Decision: Sentry (errors) + PostHog (product analytics) for monitoring

### Verified by Claude Code on 25 Sep 2026
- [x] `docs/` populated: PRD, this file, `docs/data/DipChart_20KL_MS1_HSD1.xlsx`, `docs/design-tokens.json`, `docs/design/` (design system + v2 canvas), `docs/decisions.md`
- [x] Dip chart checked: 211 rows, 0-210 cm, litres strictly increasing, 210 cm = 21,628.93 L, 123.4 cm = 13,215.37 L
- [x] Node 22.23 / npm 10.9 / Git 2.50 installed
- [x] Expo app scaffolded (SDK 57, Expo Router, TypeScript strict), blank shell; typecheck, lint, expo-doctor and web export pass
- [x] Git repo initialised, first commit pushed to GitHub
- [x] Expo account created; EAS project linked: @pumphisaab/pumphisaab (ID a7bd83b0-f5ee-4e8d-9437-ac1bd75f0c91)
- [x] Draft PRD copy, old v1 canvas and design-system zip removed (decisions D1)

### Still open
- [ ] App opened on the owner's Android phone via Expo Go with no errors
- [ ] Cash: note count vs one total per shift (decisions Q1; needed before Phase 6)
- [ ] 1 week of real notebook data (photos) into `docs/data/notebook/` (needed for Phase 3, not Phase 0)
- Deferred (decisions D4): Sentry and PostHog → Phase 8; Cloudflare account + pumphisaab.com nameservers → Phase 9

---

## Architecture decisions (locked, do not revisit without asking)

- One Expo app (Expo Router), no monorepo. Folders split by feature.
- One Expo codebase builds Android + web now; iOS later needs only an Apple developer account.
- Calculation engine written once in TypeScript (`src/calc/`, instant on-screen results) and mirrored in Postgres views (`v_shift_match`, `v_day_match`, the final truth). Both are checked against the same golden test cases.
- Money and litres never use plain floating-point decimals: `decimal.js` in TypeScript, `numeric` columns in Postgres.
- Hard checks (H1-H9 in the PRD) are enforced in the database too, not only in the app, via constraints/triggers.
- Audit log via database triggers on every insert/update/delete. No screen can bypass it.
- Multi-pump from day one: a `pump_members` table (user + pump + role) with Row Level Security on every table, even though only one pump exists today.
- User creation (owner creating a manager login) happens through a secure server-side function, never directly from the app.
- Business day, not calendar day: the day starts at the pump's start time (06:00 IST by default). Shift C, which crosses midnight, belongs to the day it started in.
- **Single Supabase project, no staging.** Claude Code never applies a migration directly. Every database change is written as a migration file and left there; the owner reviews it and pastes it into the Supabase SQL editor himself. Anything that could DROP, ALTER or TRUNCATE existing data must be called out explicitly at the top of that migration.
- Autosave on leaving every field, plus a local draft if the network drops.
- No reason prompts anywhere in the app. Soft checks save silently and raise a Flag for the owner; unlock request and unlock need no reason either. Everything is still logged.
- Sign convention: negative is always a loss (shown red, true minus sign); positive is excess (amber); zero is Matched (green).

---

## Phase plan

Each phase runs: **Setup → Brainstorm → MCQ round (lock decisions) → Build → Verify → Exit check.** Claude Code does not start a phase's Build step until the MCQ round for that phase is explicitly closed by the owner.

### Phase 0: Alignment and foundations (current phase)
- Update the PRD with any decisions made along the way (done: v1.1)
- Write CLAUDE.md (done)
- Create accounts: GitHub, Supabase, Expo (Sentry, PostHog, Cloudflare deferred, see decisions D4)
- Digitise the dip chart (done)
- **Exit:** PRD + CLAUDE.md + EXECUTION.md in the repo, Expo app scaffolded and pushed, EAS linked, dip chart and design tokens in `docs/`

### Phase 1: App shell and design system in code (~4-5 days)
- Import `design-tokens.json` into a Tailwind/NativeWind theme, with auto light/dark
- Build every design-system component; add a hidden component gallery screen to check them against Claude Design
- Role-based navigation: Today · Sales · Tanker · Profile for managers, + Dashboard for the owner, bell icon for alerts (not a tab)
- CI on GitHub: type check, lint, tests on every push
- **Exit:** component gallery matches the design; nav works on Android + web

### Phase 2: Database, login, and security (~4-5 days)
- All tables via migration files (see the ERD and field tables in the PRD): pumps, pump_members, shift_templates, fuel_prices, tanks, dip_charts, dip_chart_rows, nozzles, staff, credit_customers, expense_categories, payment_types, cash_denominations, business_days, tank_readings, shifts, shift_attendants, nozzle_readings, nozzle_tests, shift_payments, cash_counts, credit_sales, tanker_receipts, receipt_lines, expenses, flags, unlock_requests, push_tokens, audit_log
- Username + password login; owner creates manager accounts via a secure function
- Row Level Security, with a test proving Pump X can't see Pump Y's data
- Seed data for the pilot pump (tanks, nozzles, shifts, prices)
- **Exit:** owner and manager can log in and see the right data in the Supabase dashboard; the audit log fills up as rows change

### Phase 3: Calculation engine (~3-4 days, no UI)
- Dip cm to litres (linear interpolation using the chart), meter sales, testing deduction, tank sales, stock difference, shift money difference (with drawer expenses added back), tanker totals
- 30+ golden test cases, including the ones already in the PRD's Acceptance Criteria, plus more from the owner's real notebook data once transcribed
- **Exit:** 100% of golden cases pass in both the TypeScript engine and the Postgres views

### Phase 4: Owner setup — Profile > Pump settings (~4-5 days)
- Pump, shifts (configurable, changes apply from the next business day only), tanks, dip chart upload with preview and validation, nozzles mapped to tanks, staff, credit customers, payment types, cash denominations, expense categories, tolerances, fuel prices with start date, users
- **Exit:** the pilot pump is fully set up using its real dip chart and real tank/nozzle/shift layout

### Phase 5: Today — daily entry (~7-8 days, the core)
- Day lifecycle (Draft to Submitted to Locked), price Confirm strip, 8 sections with grey/amber/green states
- Opening and closing dips with auto litres, per-shift meter readings (opening auto-filled from previous closing), testing (nozzle + litres only), expenses with "paid from" a shift drawer
- Autosave and draft recovery, hard checks inline, submit blocked only by an empty section or H1-H9
- **Exit:** a full real day from the notebook can be entered in under 20 minutes and the totals match the notebook

### Phase 6: Sales and Tanker tabs (~4-5 days)
- Sales: cash by note count (auto-total), one total per other payment type per shift, credit sales (unique slip number), a "Done" button that fills empty types with ₹0, By type and By shift views
- Tanker: receipts with price and margin prefilled from the last tanker, auto totals, feeding into the day
- **Exit:** shift money match works end to end on real data

### Phase 7: Flags, owner review, and alerts (~5-6 days)
- Soft checks save and flag the owner (no reason prompts)
- Meter-change (H2) owner approval, edit-after-submit tracking, lock/unlock and unlock requests (all logged, no reason)
- Bell icon with flag list, change history ("who changed what, when")
- Android push notifications, plus a scheduled "day not submitted" reminder
- **Exit:** every flag in the PRD fires correctly in tests, and the owner gets a push within a minute

### Phase 8: Owner dashboard v1 and tracking (~3-4 days)
- Today summary, 30-day matched calendar (the North Star metric), open flags
- PostHog events from the PRD, Sentry error tracking wired up
- **Exit:** the North Star is visible in the app, and events show up in PostHog

### Phase 9: Hardening and parallel run (~2 weeks)
- **App and notebooks run side by side for at least 30 days.** Differences between them are compared every evening; every difference is investigated before trusting the app
- Testing on a cheap Android phone, in sunlight, on a slow network
- Edge cases: midnight shift, meter reset, a missed day, a price change on the boundary date, a tanker arriving mid-shift
- Daily backups confirmed, a security re-check, internal APK distribution, web live on pumphisaab.com
- **Exit:** 30 days where the app and notebooks agree, with zero data loss

### Phase 10: Pilot and measure (30+ days, then v2 planning)
- Notebooks retired, tolerances tuned on real data, baseline leakage measured
- v2 backlog: credit ledger and recovery, full owner dashboards, SaaS onboarding and billing, iOS, phone OTP login, other payment machines if the pilot shows a need

---

## Phase 0 exit criteria
Phase 0 is done when every "Still open" item above (except the deferred ones, the cash question and the notebook photos) is checked off, the repo contains `CLAUDE.md`, `docs/PRD-PumpHisaab-v1.1.md`, `docs/EXECUTION.md` (this file), `docs/data/DipChart_20KL_MS1_HSD1.xlsx`, and `docs/design-tokens.json`, and the Expo app runs on the owner's Android phone via Expo Go with no errors.

## Notes for Claude Code
- The `docs/design/` folder holds the design system and the flow canvas exported from Claude Design. Read every screen and component in it before writing any UI in later phases — it is the visual source of truth; this PRD is the behaviour source of truth.
- If anything in this file conflicts with the PRD or the design files, the PRD and design files win for their respective areas (behaviour vs visuals); flag the conflict to the owner rather than guessing.
