# Start here (new Claude Code session)

Last updated: 09 Oct 2026. **This file is the one place for "where are we".** EXECUTION.md has the phase plan; the plan files have the detail.

## 1. What to read (and what not to)
**Always:** `CLAUDE.md` (hard rules), then this file. That's enough to start.
**Only when the task needs it** (search, don't read whole files):
- `docs/decisions.md`: D1-D110, newest first. Grep by D-number or word. A decision marked "(Replaced by Dxx)" is history. Decisions override the PRD.
- `docs/learnings.md`: pump/notebook facts and build gotchas. Read section 6 (technical) before touching keyboard, text inputs, drafts, offline, EAS or Sentry.
- `docs/PRD-PumpHisaab-v1.1.md`: behaviour source of truth (with decisions on top). Search the F-number (F6 Sales, F10 engine, F11 checks…).
- `docs/design/canvas/*.dc.html` + `docs/design-tokens.json`: visual source of truth. Extract text with a small script rather than reading the HTML.
- Planned next (not built, owner 09 Oct: build in the upcoming phases): `docs/plans/ui-audit-1.md`, `docs/plans/short-tracking.md`. Last shipped: `docs/plans/archive/pilot-fixes-1.md`. Owner's current tick-box list: `docs/plans/START-HERE-owner-checklist.md` (keep it up to date; it's the only list the owner follows). Finished plans are in `docs/plans/archive/`.

## 2. Where we are
| Phase | Status |
|---|---|
| 0 Setup · 1 App shell · 2 Engine · 3 Foundations | Done 25-27 Sep |
| **4 Daily entry + go-live** | **Done.** 4a-4g built and checked; production app `com.pumphisaab.app` with the owner and 2 managers; **real days typed in the app since 01 Oct 2026**, beside the notebooks (the parallel run has started). Pilot fixes round 1 + the owner's check shipped over the air 09 Oct (production update 01a1206): split tanker over two days, drop-downs + tick list, instant ticks, cash as one total, Debit/Credit card, lighter hints, slip before vehicle, Profile › Nozzles, managers 10 days back, no default company names (D97-D108). Migrations 1-14 pasted. |
| 5 Owner loop (flags, bell, push, unlock request, owner notes, edit-after-submit) + pilot backlog | Not started — next |
| 6 Settings screens, dashboard (incl. fuel trend), PostHog | Not started |
| 7 Hardening, web on pumphisaab.com | Not started |
| 8 Pilot measure, notebooks retired | Not started (parallel run already running) |

**Pending, in the order the owner wants (no building until a phase is planned and the owner says "go"):**
1. **Phase 5 plan** (plan → MCQs → "go"), with the pilot backlog folded in:
   - Staff-wise entry (owner's demo item #7).
   - Nozzle test "what the measure got" + per-nozzle checks (D110, `short-tracking.md`): the real petrol short of 01 Oct (−26.58 L, −6.89%, nozzle problems) is being tracked by hand until then.
   - UI audit 1 (`ui-audit-1.md`, D103-D106): Today "Next" tag, Sales in numbered parts + money bar, two-step tanker, "not settled" per type per day, PhonePe, plainer words, bigger buttons.
   - Flags stored and sent, bell, unlock request, owner notes, edit-after-submit alert; push notifications (needs **one reinstall** of the app by managers).
2. **Phase 6:** settings screens (prices, limits incl. expense caps, tanks/chart, nozzles, payment and expense types, shift times, companies), Dashboard with the **fuel trend** (D109), PostHog.
4. Owner to confirm D78 (what the offline outbox covers). Odia/Hindi labels: ask the managers (later).
The owner's live list: `docs/plans/START-HERE-owner-checklist.md`.

## 3. Map of the code
- **Screens** `app/`: sign-in, starting, (tabs) today/sales/tanker/dashboard (empty, owner only)/profile, day/{opening-dip, shift, tanker, sales, credit-slip, expenses, expense, closing-dip, review}, profile/{logins, add-manager, staff, nozzles}, alerts, gallery (dev only).
- **Design system** `src/components/ui/` (all in `/gallery`; pick-one = `SelectField`, pick-many = `CheckRow`, never chips for choices, D102). Theme from tokens (`npm run theme`). Every `TextInput` uses `typingText` (D69); rows with a value beside a label wrap (learnings).
- **Engine** `src/calc/` (pure, decimal.js): limits in `rules.ts`, checks in `checks.ts`, `evaluateDay()` in `day.ts`.
- **Day feature** `src/features/day/`: `queries.ts` (all Supabase reads/saves), `model.ts` (pure, tested: sections, review summary), `useWholeDay.ts`, `NamePicker`/`CustomerPicker` (2 most used, D82), drafts (`useDraft.ts` + `src/lib/drafts.ts`, D67), offline outbox (`Outbox.tsx`, `outboxOverlay.ts`, `src/lib/outbox.ts`, D70/D78).
- **Database** `supabase/migrations/` (15 files), tests `supabase/tests/00-11` (pgTAP), `supabase/cleanup/remove-test-days.sql` (DELETES data; used once, 29 Sep), one-off data fixes in `supabase/fixes/` (2026-10-03 first day = 1 Oct). Nightly backup `.github/workflows/backup.yml` + `restore-test.yml` (idle until the owner's secrets). Views: `v_shift_money`, `v_shift_match`, `v_day_match`; `submit_day()`.
- **Golden cases** `tests/golden/cases/*.json` (from `tests/golden/generate.py`); `npm run golden:sql` regenerates `supabase/tests/03_golden.test.sql` (a test fails if it's stale).
- **Build config** `app.config.ts` (APP_VARIANT: development / preview / production, D91), `eas.json`, icons from `scripts/make-icons.py`, Sentry in `src/lib/crashReports.ts` (D90).

## 4. The live world (no secrets here)
| Thing | Where / what |
|---|---|
| GitHub | https://github.com/SubhamSamal/pumphisaab (public), branch `main`, CI = App job + Database job |
| Supabase | project `pumphisaab`, `https://iyvrnvknxiyfbkqwidec.supabase.co`, Mumbai. Migrations 1-14 pasted (ledger `schema_migrations_applied` = 14); **migration 15 (PhonePe, Cash deposited in bank) written 10 Oct, waiting for the owner to paste**. 2-5 Oct being filled from the notebooks by a one-off file in `supabase/fixes/`. First day in the app = 01 Oct 2026. Free plan. **Nightly backup on** since 09 Oct (02:00 IST, encrypted, 30 days, GitHub Actions; first restore test passed 09 Oct: 11 days, 24 readings, 31 slips, 14 migrations, 3 logins). Re-run `restore-test.yml` monthly |
| Edge Function | `create-user` (owner deployed) |
| Logins | `subham` (owner) + 2 real manager logins (made by the owner 29 Sep-03 Oct). `manager.test` removed |
| Expo / EAS | `@pumphisaab/pumphisaab`; EAS CLI logged in on the Mac as `pumphisaab`. Env vars in EAS for preview + production: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (secret, owner's) |
| Apps | **PumpHisaab** `com.pumphisaab.app` (production, channel `production`) on the owner's and 2 managers' Android phones; **PumpHisaab Preview** `com.pumphisaab.app.preview` (channel `preview`) on the owner's phone for checking changes first. The old development app was replaced. iPhone: Expo Go (dev only) |
| Sentry | sentry.io org `pumphisaab`, project `react-native` (EU region) |

## 5. How to run and check
```bash
npm run typecheck && npm run lint && npm test          # app checks
cd tools/db-local-check && node runtests.mjs           # database tests locally (PGlite, no Docker)
APP_VARIANT=preview npx eas-cli update --channel preview --environment preview --platform android --message "…"            # 1. to Preview, owner checks
APP_VARIANT=production npx eas-cli update --channel production --environment production --platform android --message "…"   # 2. to the managers' app
npx eas-cli build --platform android --profile preview|production --non-interactive --no-wait   # new APK (~20 min), only for new phone-side code
```
Signed-in screens can't be opened in the browser preview (sign-in is the live project): check logic with tests, look with the gallery, and let the owner check on the phone.

## 6. How we work with the owner
- The owner doesn't write code: plain language, short bullets, a short summary after every task.
- Phase/slice: plan in `docs/plans/` → MCQs (recommended first) → wait for "go" → build in small commits → checks + CI → owner steps, all at once, click by click, with what to send back.
- Migrations: files only; the owner pastes them. Never apply to live. DATA SAFETY header, refuse to run twice or out of order, ledger line.
- Ask before a new library, table, or hard-rule change. Log decisions and learnings the same day.
- Commit messages end with the Co-Authored-By line; push to `main`; check CI.
