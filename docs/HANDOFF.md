# Start here (new Claude Code session)

Last updated: 27 Sep 2026, Phase 4 slice 4b built (waiting for the owner to paste migration 6 and try it on the phones). This is the one page a new session reads first to pick up exactly where the last one stopped.

## 1. Read, in this order
1. `CLAUDE.md` (repo root): hard rules. They override everything.
2. **This file.**
3. `docs/EXECUTION.md`: phase plan and status checklist (verify it against the repo).
4. `docs/decisions.md`: every decision D1-D54, newest first. Where it differs from the PRD, the decision wins (D21-D33 especially).
5. `docs/learnings.md`: how the pump and notebooks really work, product, technical and process lessons.
6. `docs/PRD-PumpHisaab-v1.1.md`: behaviour source of truth (with the decisions above layered on top).
7. `docs/design/canvas/` (v2 screen flows, final) and `docs/design-tokens.json`: visual source of truth. `docs/design/design-system/components/*/README.md` notes are partly stale (D2, D13).
8. The plan and report for the phase you're continuing: `docs/plans/`.

## 2. Where we are
| Phase | Status |
|---|---|
| 0 Alignment, accounts, repo | Done 25 Sep 2026 |
| 1 App shell and design system | Done 26 Sep |
| 2 Calculation engine + golden cases | Done 26 Sep (`docs/plans/phase-2-report.md`) |
| 3 Foundations: database, security, login | Done 27 Sep (`docs/plans/phase-3-foundations.md`) |
| **4 Daily entry, slice by slice** | **In progress. 4a done and checked on Android. 4b built (migration 6: shifts, meters, testing, meter-change approval); owner steps in `docs/plans/phase-4-owner-steps.md`. Next: owner pastes migration 6 + phone check, then slice 4c (tanker).** |
| 5 Notebook comparison + owner loop (flags, lock, alerts, push) | Later |
| 6 Owner settings screens, dashboard, PostHog | Later |
| 7 Hardening and go-live | Later |
| 8 Pilot | Later |

Phase 4 slices (details in the Phase 4 plan): 4a day lifecycle + price Confirm + opening dip → 4b shift meters + testing → 4c tanker → 4d sales + credit + customer payments → 4e expenses → 4f closing dip, review, submit, autosave/drafts. Each slice = its migration + SQL view part + screen + calc wiring + tests + owner tries it on the phone.

## 3. What exists (short map)
- **App:** `app/` (Expo Router screens: sign-in, starting, (tabs) today/sales/tanker/dashboard/profile, profile/logins, profile/add-manager, profile/staff, alerts, gallery [dev only]).
- **Design system:** `src/components/ui/` (40+ components, all shown in `/gallery`). Theme generated from tokens (`npm run theme`).
- **Maths:** `src/calc/` (pure TS, decimal.js). Every limit in `src/calc/rules.ts`. `evaluateDay()` in `day.ts`.
- **Helpers:** `src/lib/` (format, businessDay, decimal, supabase client, errors, username).
- **Session:** `src/features/session/SessionProvider.tsx` (states: starting, signedOut, loading, noPump, error, notConfigured, ready). Screens are guarded by state in `app/_layout.tsx`.
- **Data hooks:** `src/features/setup/queries.ts` (TanStack Query).
- **Database:** `supabase/migrations/` (4 applied on live), `supabase/tests/` (pgTAP), `supabase/functions/create-user/` (deployed on live).
- **Golden cases:** `tests/golden/cases/*.json` (29 files; expected values computed in Python by `tests/golden/generate.py`). `npm run golden:sql` regenerates `supabase/tests/03_golden.test.sql`.
- **CI:** `.github/workflows/ci.yml`: App job (typecheck, lint, Vitest) + Database job (throwaway Supabase, all migrations, pgTAP). Both green.
- **Local DB check (optional):** `tools/db-local-check/` (PGlite, no Docker needed).

## 4. The live world (no secrets here)
| Thing | Where / what |
|---|---|
| GitHub | https://github.com/SubhamSamal/pumphisaab (public), branch `main` |
| Supabase | project `pumphisaab`, URL `https://iyvrnvknxiyfbkqwidec.supabase.co`, Mumbai. Sign-up OFF, confirm email OFF, min password 8 |
| Applied migrations | `20260926120000_foundations`, `…120100_setup_tables`, `…120200_calc_functions`, `…120300_seed_pilot_pump` (check `schema_migrations_applied`). Also `20260927120000_day_opening` (4a, pasted 27 Sep). Written, not yet pasted: `20260927130000_shift_meters` (4b) |
| Edge Function | `create-user` deployed by the owner (verify JWT on) |
| Logins | `subham` (Owner), `manager.test` (Manager, test only, remove before pilot). Hidden emails `<username>@users.pumphisaab.com` |
| `.env` | On the owner's Mac only (gitignored): `EXPO_PUBLIC_SUPABASE_URL` + publishable key. Never commit; never put a secret/service key in the app |
| Expo / EAS | project `@pumphisaab/pumphisaab`, Android package `com.pumphisaab.app`, channels development/preview/production |
| Android dev app | Built 26 Sep; installed on the owner's Android phone. Loads code from the Mac (`npm run start:android-app`, same Wi-Fi) |
| iPhone | Expo Go (`npm start`, scan with the Camera) |

## 5. How to run and check
```bash
npm start                   # Expo Go (iPhone) + web (press w)
npm run start:android-app   # our Android development app
npm run typecheck && npm run lint && npm test
```
Before every push: run the checks, and for anything touching config or types, test in a fresh clone (CI gotcha, see learnings).

## 6. How we work with the owner (important)
- The owner doesn't write code. Plain language, short bullets, one plain-language summary after every task.
- Every phase: **update docs → detailed plan in `docs/plans/` → MCQs (AskUserQuestion, recommended option first) → wait for "go" → build in small commits → verify → owner checks on the phone.**
- When the owner has to do something, give **all steps at once**, numbered, click by click, with what to send back.
- Database changes: migration files only; the owner pastes them in the Supabase SQL editor. Never apply to live. Each migration has a DATA SAFETY header, refuses to run twice or out of order, and writes itself to the ledger.
- Ask before adding a library, a table, or changing a hard rule. Log decisions in `docs/decisions.md` and learnings in `docs/learnings.md` the same day.
- Commit messages end with the Co-Authored-By line from the harness; push to `main`; check CI.

## 7. Open items to pick up
1. ~~Owner to confirm drawer cash and dues in machine totals~~: answered 27 Sep (D46, D47). D47 is a formula change to make in slice 4d.
2. More notebook days (1 of 7 transcribed: 15 Sep 2026). Each becomes a golden case.
3. Backups: Supabase Pro vs nightly copy, decide before real pilot data (Phase 5).
4. First EAS Update test with the first preview build (Phase 4, D44). Preview/production builds will need `EXPO_PUBLIC_*` set as EAS environment variables.
5. App icon and splash are still Expo's defaults (make them from the logo before the pilot).
6. Sentry comes in Phase 4 (D40); PostHog in Phase 6; Cloudflare + pumphisaab.com in Phase 7.
7. Remove `manager.test` before the pilot (part of the pre-pilot clean-up script, D45).
