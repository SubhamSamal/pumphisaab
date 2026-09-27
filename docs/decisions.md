# Decisions log

Newest first. Date, decision, why.

## 27 Sep 2026 (owner's 4b/4c phone check)

**D61. Tanker, changed by the owner** (replaces parts of D59):
- **No "No tanker today" switch.** No tanker added means none came; the Tanker section is always done ("No tanker today"). The Review before Submit (4f) asks once on a day with no tanker. (`business_days.no_tanker` stays unused.)
- **Invoice amount is required**, typed from the challan. **Price per litre = today's selling price − margin** (selling price from Today, margin prefilled from the last tanker). To pay = invoice amount − short amount; the totals also show price × litres and how much it differs from the challan (15 Sep: ₹51).
- **Chamber-wise dips are mandatory:** our tank's dip before unloading, then per chamber its litres (they vary, typed from the challan; must add up to Ordered) and our tank's dip after it. Per chamber the app shows how much the tank went up and the chamber's short (amber beyond the dip-check limit). The line's "dip after" is the last chamber's. Stored in `receipt_chambers` (migration 9); the database does the same maths (`v_receipt_chambers`).
- Petrol opens with "Add petrol"; helper text cut down.
Why: the owner's pump checks every chamber on every tanker; the challan total is what gets paid.

**D62. Meter change by the owner is approved in one step** ("Save new opening"), and an approved opening shows green ("Meter change approved"). A manager's change still waits for the owner (amber, Approve on the row and a banner on Today).

**D63. Side-by-side number boxes use 18 px numbers** (`compact`), and every number box turns off Android's extra font padding, which cut the tops off typed numbers.

## 27 Sep 2026 (slice 4d build, owner at lunch: built to the approved plan)

**D60. Sales, as built in 4d:**
- **Sales tab** has two views (canvas F6): **By shift** (Should have, every part of Received, Difference per shift) and **By type** (day total per way of payment, split by shift, "None today"). Money is typed on one screen per shift (Cash, other totals, credit slips, payments from customers, the money card), opened from either view or Today.
- **Cash:** note count per shift + coins. The cash counts as counted as soon as a note or coins is saved, or when Done is tapped. "Cash in the drawer at the start" stays empty = the previous shift's count (across days for Shift A), typed = that amount (D46).
- **Done** fills every empty box with ₹0 (coins ₹0 if nothing counted) and marks the shift's sales done; editing after Done is allowed and logged. The Sales section is done when all shifts are Done.
- **"None today"** is on the By type view for Paytm/Card/XtraPower/Bank (₹0 in every shift still empty). Credit has no separate "None today": a shift marked Done with no slips has no credit.
- **Credit slip:** shift, company (search or add, D50), vehicle, slip number, fuel, ₹ or litres; the database works out the other at the day's confirmed price with the pump's rounding (D27) and refuses a slip before Confirm (H6) or a number used before, naming who has it (H7).
- **Payments from customers:** company, amount, how paid. A payment method whose name contains "bank" carries no shift (only recorded, D47); any other is taken off the shift it's entered in. Bank ones show on every shift screen and in the day's totals.
- The worked example of the real 15 Sep day was updated to D47 (bank ₹6,00,000 of dues outside the shift; XtraPower dues ₹9,65,052 taken off); Received and Should have are unchanged at ₹6,60,664.52. New case `day-23-d47-dues-by-method`.
- The database's money check per shift is `v_shift_money` (drawer expenses join it in 4e); it gives the same answers as the app on every worked example with money.

## 27 Sep 2026 (slice 4c build, owner away: built to the approved plan)

**D59. Tanker, as built in 4c:**
- One screen per tanker (the canvas shows it in two steps: diesel, then petrol and totals). Everything fits one scroll: tanker number, invoice number, invoice date, "Unloaded on" (= the day open on Today), a card per fuel, totals, Save.
- A fuel whose **Ordered** box is empty isn't on that tanker (no extra switch). Short is empty = 0.
- Price and margin per litre are copied from the **last tanker of that fuel** and shown as one line with **Change** (canvas F4); on the very first tanker the boxes show straight away. Both are optional: without a price the totals show "—".
- Saving is one tap (**Save tanker**), not per box: a tanker is one challan. Ids are made on the phone, so a retry never adds it twice. A tanker can be **removed** (logged), e.g. if added by mistake.
- "No tanker today" is on the day (`business_days.no_tanker`) and can't be on while a tanker exists for that day.
- The database works out received, amounts, margin, dip rise and S6 (`v_receipt_lines`, `v_tanker_totals`, `v_day_received`), checked against the same worked examples as the app.

## 27 Sep 2026 (4b phone check, owner feedback)

**D55. Nozzle row redesigned by the owner** (overrides the canvas F5 row): name and litres sold ("223.26 L") on one line, then two boxes side by side, **Opening** and **Closing**. A copied opening is a grey locked box (tap it for a meter change); where there's nothing to copy (first reading in the app, or the earlier shift has no closing yet) the opening is a white box typed directly. Meter numbers are 18 px so a lakh reading fits.
Why: "Tap to type" wasn't obvious and the closing box did nothing until the opening existed.

**D56. Numbers show Indian commas while being typed** (1,26,942.71) in every number box, so lakhs and thousands can't be confused. The stored number never has commas.

**D58. The owner approves a meter change with an Approve button right on the nozzle row,** and Today shows the owner a banner ("1 meter change waiting for your approval" › Open Shift B). Found on the phone check: a note saying "tap it" wasn't enough. Sign-in shows the logo beside the name (shorter top, fits above the keyboard).

**D57. Error messages under a box are 14 px and short** ("Less than the opening. Check the meter."), and the screen keeps a message that appears while typing above the keyboard.

## 27 Sep 2026 (slice 4b build)

**D54. Meter readings, as built in 4b** (inside the approved plan):
- A day's shifts (A, B, C) are made when the day is opened, from the shift timings in force on that date; Shift C ends at 06:00 next morning and belongs to the day it started.
- The database copies each opening from the **previous shift's** closing (across days: Shift A from last night's C). When a closing is fixed later, the next shift's copied opening follows.
- A typed opening that differs from the previous closing waits for the owner (H2); the owner approves it on the reading (Approve button in the opening sheet). Changing an approved opening again needs a new approval. The very first reading in the app, or a shift whose earlier shift has no closing yet, takes a typed opening with nothing to approve.
- A shift is **done** when every in-use nozzle has an opening and a closing **and** at least one attendant is ticked (PRD F5). Testing is optional.
- H1 and H5 are refused on save; H2 and H8 are listed by `day_problems()` and will block Submit (4f).
- Meter readings are saved without the row-version check (the next shift's row changes by itself when a closing is fixed, which would otherwise make the manager's next save look like a clash). Two people typing the same nozzle at once: last save wins; both are in the audit log.

## 27 Sep 2026 (slice 4a build)

**D53. Small rules settled while building 4a** (inside the approved plan):
- A day row is created the first time someone opens it (`open_day()`), not by a nightly job. Nobody can open a future date. A manager can **start** only today and the 2 days before; the owner can start any past day (old notebook days). A day that already exists can be opened by anyone and edited if it isn't locked.
- The pump's **first day in the app** (`pumps.first_business_date`) is set to the day migration 5 is pasted. "Submit yesterday first" and the not-submitted warnings only count days from then on; the pre-pilot clean-up resets it.
- The prices the manager confirmed are stored on the day. If the owner then adds a price for that date, the strip asks again ("New price from today", showing the confirmed price as "was").
- Only a submitted day can be locked. Unlocking a day the owner locked makes it Submitted again (and exempt from auto-lock until locked).
- The owner's date picker goes back up to a year; a manager's goes back 2 days.

## 27 Sep 2026 (Phase 4 MCQ round)

Plan: `docs/plans/phase-4-daily-entry.md`.

**D45. Phase 4 slices are tried on the real pump** (Shree Lokanath), not a separate practice pump. A separate, clearly marked clean-up script removes the test days and the `manager.test` link before the pilot; the audit log keeps their history (it can't be deleted).
Why: owner's choice; keeps one pump and one setup.

**D46. Drawer cash at shift start is prefilled** from the previous shift's counted cash (Shift A from the day before's Shift C) and the manager can change it (e.g. the owner took cash out). Confirms D24 and closes the open item "cash counted includes opening drawer cash".

**D47. Customer dues payments by method** (refines D29). XtraPower (IOCL's fleet card, works like a credit card), Card (POS), Paytm and Cash dues payments land inside that shift's total, so the app takes them off before matching. Dues paid by **bank transfer** come separately, outside every shift total, so they are recorded only and never taken off. Closes the open item "machine totals include customers' dues payments". Formula change: engine, SQL view and golden cases (incl. 15 Sep) updated together in slice 4d.
Why: owner confirmed after being shown the 15 Sep XtraPower figures (₹10,03,216.67 total incl. ₹9,65,052 dues).

**D48. IOCL report stock ("Op. Stock") is optional** at the opening dip; S3 runs only on days it's typed. The opening dip is still required.

**D49. Day locking (moves into Phase 4).** A submitted day locks automatically once it is 3 business days old: on the morning of 05 Oct, 02 Oct and older lock (the database works it out from the server date; no scheduled job). A day that was never submitted does **not** auto-lock; instead Today warns about yesterday and the day before (push alert in Phase 5), so it shouldn't happen. Managers can open and edit any unlocked day. The owner can Lock or Unlock any day; a day the owner unlocks stays open (managers may edit it) until the owner taps Lock again. Manager "Request unlock" stays in Phase 5.
Why: owner wants old days fixed in place without having to lock each one by hand.

**D50. Managers can add a new credit customer** while adding a slip (like Staff, D38). The owner can rename or switch it off later.

**D51. One migration and one phone check per slice** (6 rounds in Phase 4).

**D52. Sentry is added with the first preview build** at the end of Phase 4 (one Android rebuild for both). Library `@sentry/react-native` approved.

**Housekeeping:** CLAUDE.md's pilot line said nozzles HSD-A..D / MS-A..D; the seed and D30 use HSD-1..4 / MS-1..4 (1 and 2 not in use). CLAUDE.md corrected to match.

## 27 Sep 2026 (Phase 3 close)

**D44. The first EAS Update test moves to Phase 4,** with the first standalone preview build. The development app loads code from the Mac, so an over-the-air update can't be meaningfully tested on it yet.

## 26 Sep 2026 (Phase 3 build)

**D41. Web is a single-page app** (`web.output: "single"`), not pre-rendered pages. The app sits behind a login, so there's nothing to pre-render, and the saved-login storage needs a real browser. Cloudflare Pages serves it the same way.

**D42. Audit log order uses a running number (`seq`)** as well as the exact clock time, so changes saved together always read in the right order.

**D43. Build profiles** (`eas.json`): `development` (our own dev app, Android APK), `preview` and `production` (installable APKs, no Play Store), each on its own EAS Update channel of the same name.

## 26 Sep 2026 (Phase 3 MCQ round)

**D34. Android package ID: `com.pumphisaab.app`** (permanent).

**D35. Edge Functions are pasted by the owner** in Supabase › Edge Functions, like migrations. Claude Code never deploys to the live project.

**D36. Hidden login email: `<username>@users.pumphisaab.com`** (a domain the owner controls; no email is ever sent). Replaces `@pumphisaab.app` in PRD F16.

**D37. Seed data:** pump, real dip chart, tanks, nozzles (1 and 2 not in use), shifts, payment types, notes, expense types, rules, and prices MS ₹110.07 / HSD ₹101.74 starting 15 Sep 2026. **Credit customers and staff are not seeded;** they are added in the app.

**D38. Staff list is managed in the app** (Profile › Staff: add, rename, switch off), built in Phase 3. Owner and managers can both manage staff (attendants change often); every other setup table stays owner-only.

**D39. Logins:** owner username `subham`; first manager is a test login `manager.test`, created from Profile › Logins and removed before the pilot.

**D40. Sentry waits until Phase 4** (not in Phase 3). iPhone stays on Expo Go (a development build needs a paid Apple account); Android gets the development build.

## 26 Sep 2026 (real notebook day 15 Sep 2026, owner answered 16 MCQs)

Source: `docs/data/notebook/Sept15-daily-report.pdf`, transcribed in `2026-09-15-transcription.md`.

**D21. The pump keeps a shift notebook plus a day-summary notebook.** Meters are read at 6 AM / 2 PM / 10 PM and money is collected per shift. The app stays per shift (one place for everything).

**D22. "Op. Stock" is IOCL's book (DSR) stock**, which has drifted from the dips (2,534 L MS, 4,528 L HSD on 15 Sep). **S3 is redefined:** flag when the gap (book stock − opening dip) changes from yesterday's gap by more than the limit (0.5% of the opening dip litres). Old drift is ignored; new drift is caught.

**D23. Tanker short is taken off:** received net = invoice litres − short (15 Sep: 14,000 − 28 = 13,972 L). The notebook added the full 14,000 L to the tank, so the app shows HSD −47.11 L where the notebook shows −75.

**D24. Cash is physically counted per shift and compared.** A shift's cash counted includes whatever was already in the drawer at the start (opening cash), which is subtracted. On 15 Sep: opening cash ₹36,013.04, cash in hand ₹22,919.99.

**D25. Ways of getting paid, per shift:** Cash (note count), Paytm (UPI), Card swipe (POS, debit + credit together), XtraPower (IOCL fleet card), Bank transfer, Credit. PhonePe in the PRD becomes Paytm. Names stay editable.

**D26. Settlement adjustments are ignored.** The manager types each shift's total from the Paytm / XtraPower / card machine. Bank settlement ("Adj", "not settled") is out of scope for v1; owner will confirm later if an adjustment field is needed.

**D27. Credit slip in ₹ or in litres.** Rupee fill: litres = ₹ ÷ rate, **rounded up** to 2 decimals (matches every slip on 15 Sep, e.g. ₹15,000 ÷ 101.74 = 147.4346 → 147.44). Litre fill: ₹ = litres × rate, rounded to paise. Rounding direction is a setting.

**D28. Cash advance to a credit customer** (S.V.T. ₹11,000) is an expense paid from the shift drawer, category "Cash advance to credit customer". It will also count against the customer's dues once the ledger exists (v2).

**D29. Payments from customers** (old dues or advances; by bank, XtraPower, Paytm, card or cash) get a simple entry: customer, ₹, how, shift. They are kept out of fuel sales: the amount is taken off that shift's matching machine/bank total (or drawer, if cash) before matching. Full ledger and balances stay v2. The ₹1/L discount for 2 partner customers is given later on their bill, so slips stay at full price and the day is unaffected.

**D30. Nozzles 1 and 2 (both fuels) are not in use.** Marked inactive: no readings needed, no flags.

**D31. Slip numbers come from the pump's own books;** a number can never repeat across customers (H7 as in the PRD).

**D32. Testing is random:** any nozzle, any shift, usually 10 L per fuel per day. The per-shift "nozzle + litres" design stays.

**D33. Expense types:** Salary, Staff advance, Tiffin, Staff food, Bakshis, DG rent, Tanker unloading, Tanker driver food, Cash advance to credit customer, Other (owner can rename/add).

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
