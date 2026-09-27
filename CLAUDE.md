# CLAUDE.md: PumpHisaab

Read this file fully before every task. If a request conflicts with this file, stop and ask.
In a new session, read `docs/HANDOFF.md` next: it says where the project stands and what to do first.

## What we are building
PumpHisaab ("Sara hisaab ek jagah"): a mobile-first app for Indian petrol pumps. Managers enter the day's dips, meter readings, testing, money received, credit sales, tanker receipts and expenses. The app auto-calculates and matches **sold as per tank vs sold as per meters vs money received**, per shift and per day, and flags leaks to the owner.

- **Behaviour source of truth:** `docs/PRD-PumpHisaab-v1.1.md`
- **Visual source of truth:** Claude Design canvas + `docs/design-tokens.json`
- **Pilot pump:** Shree Lokanath Filling Station (IOCL). 1 MS + 1 HSD tank (20 KL, same chart, max 21,628.93 L), nozzles HSD-1..4 and MS-1..4 (1 and 2 not in use, D30), shifts A 06-14, B 14-22, C 22-06, business day starts 06:00 IST.

## The owner of this repo does not write code
- Explain what you changed in plain language, in short bullets, after every task.
- Never leave the app broken. Run all checks before saying a task is done.
- Ask before adding a new library, a new table, or changing anything in "Hard rules".

## Stack
- Expo (latest SDK) + Expo Router, TypeScript strict mode, one app for Android + web (iOS later).
- NativeWind (Tailwind) with theme generated from `docs/design-tokens.json`. Auto light/dark.
- Supabase: Postgres, Auth, Row Level Security, Edge Functions, pg_cron.
- TanStack Query (server data), React Hook Form + Zod (forms), decimal.js (all money and litre maths).
- Tests: Vitest (TypeScript), pgTAP (database). Sentry (errors), PostHog (events), Expo Notifications (Android push).
- Web hosting: Cloudflare Pages. Android builds: EAS.

## Folder map
```
app/                    Expo Router screens: (auth), (tabs)/today, sales, tanker, dashboard, profile
src/components/ui/      Design system components only (no business logic)
src/features/<name>/    Feature screens, hooks, queries (today, sales, tanker, setup, flags, dashboard)
src/calc/               Pure calculation engine (no React, no Supabase imports)
src/lib/                supabase client, formatting (₹, L, cm), dates/business day, analytics
supabase/migrations/    SQL migrations (only way to change the database)
supabase/functions/     Edge Functions (create user, push sender)
supabase/tests/         pgTAP tests (RLS, triggers, views)
tests/golden/           Golden calculation cases (JSON) shared by Vitest and pgTAP
docs/                   PRD, design tokens, decisions log (docs/decisions.md), learnings/KT (docs/learnings.md), start-here (docs/HANDOFF.md), phase plans (docs/plans/)
tools/                  Developer-only helpers, not part of the app (tools/db-local-check)
```

## Hard rules
1. **Only one Supabase project exists: `pumphisaab` (real, live data from day one).** Never call a Supabase CLI or API command that applies a migration to it. Write every database change as a migration file in `supabase/migrations/` and stop there — the owner reviews it and pastes it into the Supabase SQL editor himself.
2. **Migration files only; never click-edit tables; never edit a migration once applied.** A fix is a new migration. Flag clearly, at the top of any migration, whether it can DROP, ALTER or TRUNCATE existing data, so the owner reviews those extra carefully before pasting.
3. **No floating-point money or litres.** Use decimal.js in TypeScript and `numeric` in Postgres. Round money to 2 decimals, half-up, only for display.
4. **One calculation logic, two places, same results.** `src/calc/` (instant UI) and SQL views `v_shift_match`, `v_day_match` (final truth). Every formula change must pass `tests/golden/` in both.
5. **Every table has** `id uuid`, `pump_id` (except pumps), `created_by`, `created_at`, `updated_by`, `updated_at`, **RLS enabled**, and the audit trigger. A new table without these is not done.
6. **Hard checks H1-H9 are enforced in the database too** (constraints/triggers), not only in the UI.
7. **No reason prompts anywhere.** Soft checks save and create a row in `flags`. Unlock request and unlock have no reason field.
8. **Sign rule:** Difference is shown so that negative = loss (red, true minus sign), positive = excess (amber), zero = Matched (green). Stock Difference = sold as per meters minus sold as per tank. Money Difference = received minus should have.
9. **Business day, not calendar day.** Use `src/lib/businessDay.ts` for every date decision. Shift C after midnight belongs to the day it started. Time zone is Asia/Kolkata.
10. **Prices:** only the owner adds prices (with start date). Price for a day = latest price with effective_from <= business date. Managers only confirm.
11. **Secrets** live in `.env` files, never in code or commits. Only the anon key goes in the app; the service role key is used only inside Edge Functions.
12. **UI uses only `src/components/ui/`** components and theme tokens. No hard-coded colours, font sizes or spacing. If a new component is needed, add it to the gallery screen and tell the owner.
13. **Words in the UI:** Should have, Received, Sold as per tank, Sold as per meters, Difference, Flag. Never "debit/credit/variance/reconciliation" in the UI.
14. **Formatting:** ₹ in Indian grouping (₹1,50,490), litres with "L" and up to 2 decimals, dips with 1 decimal and "cm", dates like 01 Oct 2026.

## Definition of done (every task)
- `npm run typecheck`, `npm run lint`, `npm test` pass; `supabase test db` passes if SQL changed.
- New logic has tests; formula changes update `tests/golden/`.
- Screens checked in light and dark mode at 390 px width and on web.
- **Keyboard never covers what's being typed** (owner's rule, 27 Sep): every screen with a typing box sits in `ScreenBody` or `KeyboardSafeScroll`, and sheets use `BottomSheet` (never a raw ScrollView/KeyboardAvoidingView). The box being typed in, any message under it, and the button needed next must stay visible above the keyboard on Android and iPhone. `tests/keyboard-safety.test.ts` enforces the first part; check the second on the phone for every new form.
- Analytics events from the PRD are fired where relevant.
- A short plain-language summary: what changed, how to see it, anything the owner must do.

## Working style
- Small steps. One feature slice at a time, committed with a clear message.
- Before a big change, write a short plan and wait for "go".
- Log every product or technical decision in `docs/decisions.md` (date, decision, why).
- Add every new learning about the pump, the notebooks or the build to `docs/learnings.md` (the project KT).
- If the PRD is unclear or contradicts the design, ask; do not guess.
