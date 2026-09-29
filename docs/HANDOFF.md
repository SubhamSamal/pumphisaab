# Start here (new Claude Code session)

Last updated: 29 Sep 2026. **This file is the one place for "where are we".** EXECUTION.md has the phase plan; the plan files have the detail.

## 1. What to read (and what not to)
**Always:** `CLAUDE.md` (hard rules), then this file. That's enough to start.
**Only when the task needs it** (search, don't read whole files):
- `docs/decisions.md`: D1-D91, newest first. Grep by D-number or word. A decision marked "(Replaced by Dxx)" is history. Decisions override the PRD.
- `docs/learnings.md`: pump/notebook facts and build gotchas. Read section 6 (technical) before touching keyboard, text inputs, drafts, offline, EAS or Sentry.
- `docs/PRD-PumpHisaab-v1.1.md`: behaviour source of truth (with decisions on top). Search the F-number (F6 Sales, F10 engine, F11 checks…).
- `docs/design/canvas/*.dc.html` + `docs/design-tokens.json`: visual source of truth. Extract text with a small script rather than reading the HTML.
- The current plan: `docs/plans/phase-4g-preview-build.md`; owner steps still to do: `docs/plans/phase-4-owner-steps.md`. Finished plans are in `docs/plans/archive/`.

## 2. Where we are
| Phase | Status |
|---|---|
| 0 Setup · 1 App shell · 2 Engine · 3 Foundations | Done 25-27 Sep |
| **4 Daily entry** | **4a-4f built and checked on Android** (day, price, dips, shifts, tanker, sales, expenses, closing dip, Review with red/yellow/green Summary, Submit, offline outbox, drafts). **4g in progress:** preview APK built and installed (`com.pumphisaab.app.preview`), Sentry test report received; first over-the-air update published (`eas update --channel preview`, update 01a0eb4), waiting for the owner's screenshot. |
| 5 Owner loop (flags, bell, push, unlock request, owner notes, backups, notebook comparison) | Not started |
| 6 Settings screens, dashboard, PostHog | Not started |
| 7 Hardening, go-live, web on pumphisaab.com | Not started |
| 8 Pilot | Not started |

**Still open in Phase 4:**
1. Owner: confirm the OTA update arrived (Profile line "… update 01a0eb4 (over the air)").
2. Owner: paste migration 13 if not done (`select count(*) from schema_migrations_applied` → 13), finish and submit 27 Sep.
3. Owner: Step 4, the end-to-end test (15 Sep notebook numbers typed into 28 Sep, stopwatch; expected totals in the owner steps file). This is the **Phase 4 exit check**.
4. Owner to confirm D78 (what the offline outbox covers).
Then plan Phase 5 (plan → MCQs → "go").

## 3. Map of the code
- **Screens** `app/`: sign-in, starting, (tabs) today/sales/tanker/dashboard/profile, day/{opening-dip, shift, tanker, sales, credit-slip, expenses, expense, closing-dip, review}, profile/{logins, add-manager, staff}, alerts, gallery (dev only).
- **Design system** `src/components/ui/` (all in `/gallery`). Theme from tokens (`npm run theme`). Every `TextInput` uses `typingText` (D69); rows with a value beside a label wrap (learnings).
- **Engine** `src/calc/` (pure, decimal.js): limits in `rules.ts`, checks in `checks.ts`, `evaluateDay()` in `day.ts`.
- **Day feature** `src/features/day/`: `queries.ts` (all Supabase reads/saves), `model.ts` (pure, tested: sections, review summary), `useWholeDay.ts`, `NamePicker`/`CustomerPicker` (2 most used, D82), drafts (`useDraft.ts` + `src/lib/drafts.ts`, D67), offline outbox (`Outbox.tsx`, `outboxOverlay.ts`, `src/lib/outbox.ts`, D70/D78).
- **Database** `supabase/migrations/` (13 files), tests `supabase/tests/00-11` (pgTAP), `supabase/cleanup/remove-test-days.sql` (DELETES data, owner decides, D80). Views: `v_shift_money`, `v_shift_match`, `v_day_match`; `submit_day()`.
- **Golden cases** `tests/golden/cases/*.json` (from `tests/golden/generate.py`); `npm run golden:sql` regenerates `supabase/tests/03_golden.test.sql` (a test fails if it's stale).
- **Build config** `app.config.ts` (APP_VARIANT: development / preview / production, D91), `eas.json`, icons from `scripts/make-icons.py`, Sentry in `src/lib/crashReports.ts` (D90).

## 4. The live world (no secrets here)
| Thing | Where / what |
|---|---|
| GitHub | https://github.com/SubhamSamal/pumphisaab (public), branch `main`, CI = App job + Database job |
| Supabase | project `pumphisaab`, `https://iyvrnvknxiyfbkqwidec.supabase.co`, Mumbai. Migrations 1-12 pasted; 13 written (check the ledger `schema_migrations_applied`) |
| Edge Function | `create-user` (owner deployed) |
| Logins | `subham` (owner), `manager.test` (test only; removed by the clean-up script) |
| Expo / EAS | `@pumphisaab/pumphisaab`; EAS CLI logged in on the Mac as `pumphisaab`. Env vars in EAS for preview + production: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (secret, owner's) |
| Apps on the owner's Android | dev app `com.pumphisaab.app` (loads code from the Mac: `npm run start:android-app`) and **PumpHisaab Preview** `com.pumphisaab.app.preview` (standalone, channel `preview`). iPhone: Expo Go |
| Sentry | sentry.io org `pumphisaab`, project `react-native` (EU region) |

## 5. How to run and check
```bash
npm run typecheck && npm run lint && npm test          # app checks
cd tools/db-local-check && node runtests.mjs           # database tests locally (PGlite, no Docker)
APP_VARIANT=preview npx eas-cli update --channel preview --environment preview --platform android --message "…"   # over-the-air fix
npx eas-cli build --platform android --profile preview --non-interactive --no-wait                                  # new preview APK (~20 min)
```
Signed-in screens can't be opened in the browser preview (sign-in is the live project): check logic with tests, look with the gallery, and let the owner check on the phone.

## 6. How we work with the owner
- The owner doesn't write code: plain language, short bullets, a short summary after every task.
- Phase/slice: plan in `docs/plans/` → MCQs (recommended first) → wait for "go" → build in small commits → checks + CI → owner steps, all at once, click by click, with what to send back.
- Migrations: files only; the owner pastes them. Never apply to live. DATA SAFETY header, refuse to run twice or out of order, ledger line.
- Ask before a new library, table, or hard-rule change. Log decisions and learnings the same day.
- Commit messages end with the Co-Authored-By line; push to `main`; check CI.
