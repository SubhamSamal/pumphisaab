# Decisions log

Newest first. Date, decision, why.

## 26 Sep 2026 (Phase 1 decisions, owner answered the MCQ round)

**D7. Phase 1 libraries approved:** NativeWind 4.2 + Tailwind 3.4 (current stable, not the v5 preview), Inter via `@expo-google-fonts/inter`, Lucide icons (`lucide-react-native` + `react-native-svg`), Vitest, decimal.js. All run in Expo Go.
Why: in the CLAUDE.md stack or required by the design (Lucide, Inter).

**D8. Gallery and role switch are developer-only.** The component gallery and an Owner/Manager preview switch exist only in development (Expo Go / localhost), never in released builds.
Why: login arrives in Phase 2; no extra surface in the real app.

**D9. Tabs show simple empty states in Phase 1** (title, bell, one line saying which phase fills it). No fake numbers.

**D10. Light / Dark / Auto switch in Profile is built in Phase 1.** Default Auto (follows the phone); the choice is remembered on that phone only.

**D11. AsyncStorage added** (`@react-native-async-storage/async-storage`) to remember the theme choice; it will also hold offline drafts in Phase 5. Owner approved.

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

**Q1. Cash entry: note count or one total per shift?** The PRD (F6, acceptance case 4) says note count (₹500 × n ...). Canvas Flow 6 says "Cash ... works the same way: one box per shift". Until answered, the PRD (note count) stands. Needed before Phase 6.
