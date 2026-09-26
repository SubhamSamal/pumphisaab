# Decisions log

Newest first. Date, decision, why.

## 26 Sep 2026 (Phase 2 MCQ round)

**D18. Notebook week: owner sends photos, Claude transcribes.** Photos go in `docs/data/notebook/`; Claude fills a spreadsheet from them; the owner checks it once for misread numbers before the days become golden cases.

**D19. R1 (IOCL compliance) = |Stock Difference| beyond 4% of the day's sold as per tank + that fuel's evaporation allowance.** Allowances by yearly sales: HSD above 600 KL/year → 0.20%; MS below 600 KL/year → 0.75%. So R1 fires beyond 4.20% for HSD and 4.75% for MS. Stored as settings the owner can change later.
Why: same base as S1, easy to explain.

**D20. Cash is entered as a note count** (closes open question Q1). Notes × value + coins = cash total, per shift. Matches the PRD and removes hand-adding mistakes.

## 26 Sep 2026 (Phase 1 decisions, owner answered the MCQ round)

**D7. Phase 1 libraries approved:** NativeWind 4.2 + Tailwind 3.4 (current stable, not the v5 preview), Inter via `@expo-google-fonts/inter`, Lucide icons (`lucide-react-native` + `react-native-svg`), Vitest, decimal.js. All run in Expo Go.
Why: in the CLAUDE.md stack or required by the design (Lucide, Inter).

**D8. Gallery and role switch are developer-only.** The component gallery and an Owner/Manager preview switch exist only in development (Expo Go / localhost), never in released builds.
Why: login arrives in Phase 2; no extra surface in the real app.

**D9. Tabs show simple empty states in Phase 1** (title, bell, one line saying which phase fills it). No fake numbers.

**D10. Light / Dark / Auto switch in Profile is built in Phase 1.** Default Auto (follows the phone); the choice is remembered on that phone only.

**D11. AsyncStorage added** (`@react-native-async-storage/async-storage`) to remember the theme choice; it will also hold offline drafts in Phase 5. Owner approved.

**D12. Component geometry follows the canvas stylesheet exactly.** Screens may use only theme tokens (colours, type, the 4-40 px spacing scale, radii, sizes). Inside `src/components/ui/` only, a few exact measurements from `docs/design/canvas/ph.css` that aren't tokens are used as-is (e.g. 28 px pills, 10 px row padding, 92 | 1fr | 80 nozzle grid, 52 px calendar cells). Tailwind's default colours, font sizes, spacing and radii are removed, so a non-token class doesn't exist.

**D13. Where the canvas and the design-system notes differ on components, the canvas wins** (extends D2):
- Units trail the number in every input, including ₹ ("1,21,600 ₹"); values are left-aligned.
- Short and Excess both use the warning-triangle icon; Matched uses a tick; "Not matched" pill uses an X; "Submitted" pill uses a send icon.
- Section "not started" = grey outline circle; flags on a section = amber count; hard errors = red count.
- A difference inside the owner's limit shows green "OK · 30 L" (the limit check itself belongs to the calc engine, Phase 3).

**D14. Components built later, with the screen that first needs them:** searchable select and date field (Phase 4/6), payment-type row and equation lines (Phase 6), price Confirm strip (Phase 5), change-history list (Phase 7). Each is added to the gallery when built.

**D15. Phases re-planned** (owner approved after a CTO review). Calc engine moves before the database (it's the riskiest part and defines what must be stored). Daily entry is built in vertical slices (tables + screen + tests per section) instead of all tables first. The 30-day notebook comparison starts as soon as a full day can be submitted. The pilot pump is seeded by migration; full setup screens move after the pilot starts (prices, logins and limits first). New order is in `docs/EXECUTION.md`.
Why: less risk to live data, mistakes found in days not weeks, first real day on the phone ~2 weeks sooner.

**D16. Database safety net: throwaway database in CI.** Every push builds a temporary Supabase from all migrations inside GitHub Actions and runs pgTAP. Each migration also records itself in a ledger table so the live database can be checked against the repo. Hard rule 1 unchanged: the live project is only ever changed by the owner pasting reviewed SQL.

**D17. Robustness built in from Phase 3:** own development build + EAS Update for instant fixes (Expo Go can't receive Android push anyway); Sentry from the first real data (Phase 3), PostHog stays with the dashboard (Phase 6); idempotent saves; server time decides the business date; row versions to catch two people editing the same thing; dip charts versioned, never edited in place.

**Open: backups** (Supabase Pro vs free plan + nightly copy). Owner chose "decide later"; must be settled before real pilot data (Phase 5). Note: the free plan pauses projects inactive for a week.

## 25 Sep 2026

**D1. One PRD.** `docs/PRD-PumpHisaab-v1.1.md` is the only PRD. The draft copy that lived in the design canvas folder was deleted, along with the old v1 canvas and the design-system zip (duplicate of the folder).
Why: owner confirmed. Two PRDs that disagree is a bug factory.

**D2. The v2 design canvas (`docs/design/canvas/`) is the final design.** Where the design-system component notes (`docs/design/design-system/components/*/README.md`, `formatting.md`, `README.md`) disagree with the canvas or the PRD, the canvas and PRD win. Known stale bits in the design-system notes, to be ignored:
- "Add reason" buttons, reason sheet, reason chip in audit rows, "edit requires a reason" on NozzleRow (hard rule 7: no reasons).
- SectionCard "Not started = red dot" (now a grey circle).
- ReconCard words Expected / Collected / Variance, Tank L / Nozzle L (now Should have / Received / Difference, Sold as per tank / Sold as per meters).
- "PRD engine formula Tank − Nozzle is flipped at display" (the PRD now defines Difference = meters − tank directly; no flip anywhere).
- Alerts as a nav tab with a badge (now a bell, top right).
- "Edit prices" link on the Today top bar (managers only Confirm).
- ProgressBar "7 of 10" (now 8 sections).
Why: owner confirmed the canvas is final; the component notes were written before the v2 walkthrough.

**D3. Three canvas features are in v1** (they are in the canvas but not yet in the PRD):
- **Owner notes:** the owner pins a note to a section (e.g. "Shift B sales") with quick phrases; the manager gets a push, bell count, a Today banner with a button to the right screen, and a badge on that card; the manager can reply or just fix the number and mark it seen. Needs a new `owner_notes` table in Phase 2 (all standard columns, RLS, audit trigger) and events `owner_note_sent`, `owner_note_seen`.
- **Yesterday first:** if the previous business day isn't submitted, the manager can fill today but can't submit it until yesterday is submitted (red banner "Submit 01 Oct first").
- **"None today" buttons** on empty Credit, XtraPower and Bank transfer (canvas Flow 15) so an unused type still counts as done.
Why: owner confirmed "design canvas is the final one".

**D4. Monitoring and hosting accounts deferred.** Sentry, PostHog and Cloudflare are not created yet and are no longer Phase 0 blockers. Create Sentry + PostHog at the start of Phase 8, Cloudflare (and point pumphisaab.com) in Phase 9.
Why: nothing uses them before then.

**D5. Canvas sample numbers are illustrative only.** The canvas dip-chart screen shows a 20,000 L tank up to 195 cm (128.5 cm = 14,820 L). The real pilot chart is 0-210 cm, full = 21,628.93 L, and 128.5 cm = 13,870.76 L. Code and tests use only `docs/data/DipChart_20KL_MS1_HSD1.xlsx`.

**D6. Expo app layout.** Expo SDK 57, default template reduced to a blank shell. Routes live in `app/` at the repo root (per CLAUDE.md), not the template's `src/app/`. ESLint uses `eslint-config-expo`. Template demo screens, Expo's MIT licence file and its Claude/VS Code settings were removed.

## Open (need the owner)

- Backups: Supabase Pro vs free plan + nightly copy (before real pilot data, Phase 5). See D17 note.
