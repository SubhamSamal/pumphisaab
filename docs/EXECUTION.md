# PumpHisaab: Execution Plan

This file is context for Claude Code. Read it after CLAUDE.md and the PRD. It has the full phase plan and what is done so far. **Verify the "Status" section against the real repo and environment before trusting it** — it was last updated by hand and may be stale.

---

## Status snapshot (last updated 26 Sep 2026, evening)

**Where we are:** Phases 0, 1 and 2 done. Next: Phase 3 (foundations), plan in `docs/plans/phase-3-foundations.md`, waiting for the owner's "go".

### Phase 0: accounts, docs, repo (done 25 Sep 2026)
- [x] Brand: PumpHisaab, "Sara hisaab ek jagah", domain pumphisaab.com bought
- [x] PRD v1.1 (`docs/PRD-PumpHisaab-v1.1.md`) + later additions in `docs/decisions.md`; CLAUDE.md at repo root
- [x] Design system + v2 screen-flow canvas exported to `docs/design/`; tokens in `docs/design-tokens.json`
- [x] Dip chart digitised and checked: `docs/data/DipChart_20KL_MS1_HSD1.xlsx` (211 rows, 0-210 cm, full = 21,628.93 L, 123.4 cm = 13,215.37 L)
- [x] GitHub repo (public since 26 Sep): https://github.com/SubhamSamal/pumphisaab
- [x] Supabase project `pumphisaab` (Mumbai), single live project; nothing created in it yet
- [x] Expo account; EAS project @pumphisaab/pumphisaab linked
- [x] Expo app scaffolded (SDK 57, Expo Router, TypeScript strict); checked on owner's iPhone (Expo Go) and web
- [x] Decisions: direct-install APK (no Play Store for pilot), Cloudflare Pages for web, Sentry + PostHog for monitoring

### Phase 1: app shell and design system (done 26 Sep 2026)
- [x] Theme generated from the design tokens (`npm run theme`); a test fails if code and tokens drift; only token colours/sizes exist
- [x] Inter font, tabular numbers; Light / Dark / Auto (remembered on the phone)
- [x] 40+ design-system components in `src/components/ui/`, matched to the v2 canvas; developer-only gallery at `/gallery`
- [x] Navigation: Today · Sales · Tanker · Profile (+ Dashboard for owner), bell → Alerts, left rail on web ≥ 1024 px; tabs show "arrives in Phase N"
- [x] Shared formatting (`src/lib/format.ts`): ₹ Indian grouping, litres, meters, dip cm, dates, vehicle numbers, signed differences
- [x] Business day (`src/lib/businessDay.ts`): 06:00 IST start, Shift C after midnight counts for the day before
- [x] CI on GitHub: typecheck, lint, 30 tests on every push (green)
- [x] Libraries approved: NativeWind, Tailwind 3, Inter, Lucide, Vitest, decimal.js, AsyncStorage (D7, D11)
- [x] Phases re-planned: calc first, daily entry in slices, CI database safety net (D15-D17)

### Phase 2: calculation engine (done 26 Sep 2026)
- [x] Engine in `src/calc/` (pure TypeScript, exact decimals); every limit in `src/calc/rules.ts`
- [x] All hard checks H1-H9 and soft checks S1-S4, S6, S7, S9, R1
- [x] 28 golden case files incl. PRD 1-8, the canvas day and the real notebook day 15 Sep 2026; expected answers computed separately in Python
- [x] Real notebook day understood (16 MCQs, decisions D21-D33); report in `docs/plans/phase-2-report.md`
- [x] 65 tests green, CI green
- [x] Project KT started: `docs/learnings.md` (how the pump and notebooks really work, product, build and process learnings); CLAUDE.md now requires keeping it updated

### Still open
- [ ] Android phone check in Expo Go (same QR code)
- [ ] More notebook days (1 of 7 done: 15 Sep 2026); each becomes a golden case
- [x] Cash: note count (D20)
- [ ] Backups: Supabase Pro vs nightly copy (before real pilot data, Phase 5)
- [ ] Owner to confirm: cash counted includes opening drawer cash; machine totals include customers' dues payments
- Deferred: Sentry → Phase 3; PostHog → Phase 6; Cloudflare + pumphisaab.com → Phase 7

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

### Phase 0: Alignment and foundations — done 25 Sep 2026
- Update the PRD with any decisions made along the way (done: v1.1)
- Write CLAUDE.md (done)
- Create accounts: GitHub, Supabase, Expo (Sentry, PostHog, Cloudflare deferred, see decisions D4)
- Digitise the dip chart (done)
- **Exit:** PRD + CLAUDE.md + EXECUTION.md in the repo, Expo app scaffolded and pushed, EAS linked, dip chart and design tokens in `docs/`

### Phase 1: App shell and design system in code (~4-5 days) — done 26 Sep 2026 (checked on owner's iPhone and web; CI green). Android check pending
- Import `design-tokens.json` into a Tailwind/NativeWind theme, with auto light/dark
- Build every design-system component; add a hidden component gallery screen to check them against Claude Design
- Role-based navigation: Today · Sales · Tanker · Profile for managers, + Dashboard for the owner, bell icon for alerts (not a tab)
- CI on GitHub: type check, lint, tests on every push
- **Exit:** component gallery matches the design; nav works on Android + web

> **Re-planned 26 Sep 2026** (decisions D15-D17). Old order: DB → calc → setup UI → Today → Sales/Tanker → flags → dashboard → hardening. New order below: maths first, daily entry in vertical slices, notebook comparison starts as soon as a full day can be submitted, full setup screens after the pilot starts.

### Phase 2: Calculation engine + golden cases — done 26 Sep 2026 (plan: `docs/plans/phase-2-calc-engine.md`, report: `docs/plans/phase-2-report.md`)
- Pure TypeScript in `src/calc/` with decimal.js: dip cm → litres (linear interpolation on the real chart), meter sales, test deduction, sold as per tank, stock Difference and %, shift Should have / Received / Difference (drawer expenses added back), tanker totals, Matched decision against tolerances, hard checks H1-H9 and soft checks S1-S9/R1 as pure functions
- `tests/golden/*.json`: every PRD acceptance case (1-8) plus the owner's notebook week once transcribed; 30+ cases. Same files will drive the SQL tests later
- Output: the exact list of inputs the engine needs, which becomes the database design in Phase 3
- **Exit:** 100% golden cases pass in Vitest; engine reviewed against the notebook numbers

### Phase 3: Foundations (~5-6 days) — detailed plan: `docs/plans/phase-3-foundations.md`
- **Database safety net:** GitHub CI builds a throwaway Supabase from every migration on each push and runs pgTAP (RLS, triggers, constraints, golden cases through the SQL views). The live project is never touched by CI or Claude Code
- **Migration ledger:** every migration ends by recording itself in a `schema_migrations_applied` table, so we can check the live database matches the repo
- Core tables only: pumps, pump_members, dip_charts (versioned, never edited in place) + rows, tanks, nozzles, shift_templates, fuel_prices, staff, payment_types, cash_denominations, expense_categories, audit_log; audit trigger; RLS on every table; row version for conflict detection
- Username + password login; owner creates manager logins via Edge Function
- Pilot pump seeded by migration (tanks, real dip chart, 8 nozzles, shifts A/B/C, payment types, prices)
- Own development build of the app (EAS) replacing Expo Go; EAS Update channels for instant fixes; Sentry crash tracking
- **Exit:** owner and manager log in on their phones; RLS test proves Pump X can't see Pump Y; CI green including pgTAP

### Phase 4: Daily entry, slice by slice (~10-12 days)
Each slice = its tables (migration) + SQL view part + screen + calc wiring + tests + tried on the owner's phone.
- 4a Day lifecycle, price Confirm strip, opening stock and dip
- 4b Shift meters (A/B/C) + testing, H1/H2/H8
- 4c Tanker tab + receipts, feeding the day
- 4d Sales tab: cash note count, other types per shift, credit slips, Done
- 4e Expenses with "paid from" drawer
- 4f Closing dip, Review (tank vs meters, money by shift, flags list), Submit, "yesterday first", autosave + local drafts
- Saves are idempotent (safe to retry); business date comes from server time; scripted end-to-end test of a full day
- **Exit:** a full real day from the notebook entered in under 20 minutes and totals match the notebook

### Phase 5: Notebook comparison starts + owner loop (~6-7 days, comparison runs 30+ days alongside)
- **Parallel run begins:** app and notebooks side by side every day; differences investigated each evening
- Flags table and soft checks raising flags (no reasons), edit-after-submit tracking, meter-change approval (H2), lock / unlock / unlock request, owner notes (D3), bell with alerts, change history
- Android push notifications + "day not submitted" reminder
- Backups decided and in place before real pilot data (decision pending: Pro plan or nightly copy)
- **Exit:** every PRD flag fires in tests; owner gets a push within a minute

### Phase 6: Owner settings screens, dashboard, tracking (~5-6 days)
- Profile > Fuel prices, Logins, When to flag first; then tanks, dip chart upload with preview/validation, nozzles, staff, credit companies, payment types, expense types, shift timings (effective next business day)
- Dashboard: today summary, 30-day matched calendar (North Star), open flags
- PostHog events from the PRD
- **Exit:** a second test pump can be fully set up from the app alone; North Star visible; events in PostHog

### Phase 7: Hardening and go-live (~1-2 weeks, overlapping the end of the parallel run)
- Cheap Android phone, sunlight, slow network; edge cases (midnight shift, meter reset, missed day, price change on the boundary date, tanker mid-shift)
- Backup **restore tested for real**; security re-check; internal APK distribution; web live on pumphisaab.com (Cloudflare)
- **Exit:** 30 days where app and notebooks agree, zero data loss

### Phase 8: Pilot and measure (30+ days, then v2 planning)
- Notebooks retired, tolerances tuned on real data, baseline leakage measured
- v2 backlog: credit ledger and recovery, full owner dashboards, SaaS onboarding and billing, iOS, phone OTP login

## Phase 0 exit criteria
Phase 0 is done when every "Still open" item above (except the deferred ones, the cash question and the notebook photos) is checked off, the repo contains `CLAUDE.md`, `docs/PRD-PumpHisaab-v1.1.md`, `docs/EXECUTION.md` (this file), `docs/data/DipChart_20KL_MS1_HSD1.xlsx`, and `docs/design-tokens.json`, and the Expo app runs on the owner's Android phone via Expo Go with no errors.

## Notes for Claude Code
- The `docs/design/` folder holds the design system and the flow canvas exported from Claude Design. Read every screen and component in it before writing any UI in later phases — it is the visual source of truth; this PRD is the behaviour source of truth.
- If anything in this file conflicts with the PRD or the design files, the PRD and design files win for their respective areas (behaviour vs visuals); flag the conflict to the owner rather than guessing.
