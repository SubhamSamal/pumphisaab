# PumpHisaab: Learnings and knowledge transfer (KT)

Everything we've learned about the pump, the notebooks, the product and the build, in one place.
Anyone new to the project (a person, or Claude Code in a new session) should be able to read this and understand how the pump really works and why the app is built the way it is.

- **Decisions** (what we chose) live in `docs/decisions.md` (D1, D2 …). This file explains the **why** and the **how things really work**, and points to the decisions.
- **Keep it growing:** every new notebook day, owner answer or surprise gets added here, newest learnings at the end of each section, with the date.

Last updated: 27 Sep 2026 (Phase 4 MCQ round)

---

## 1. The pump (pilot site)

| | |
|---|---|
| Name | Shree Lokanath Filling Station |
| Oil company | IOCL (Indian Oil) |
| Place | Dhenkanal, Odisha |
| Owner | Subham Samal (doesn't write code; reviews plans, answers MCQs, pastes SQL into Supabase) |
| Fuel depot | IOCL Jatni, Bhubaneswar (tankers come from here) |
| Tanks | 2: **MS-1** (petrol) and **HSD-1** (diesel). Both 20 KL horizontal, 210 cm diameter, 625 cm long, same IOCL chart |
| Real full tank | **21,628.93 L at 210 cm**, not the nominal 20,000 L |
| Nozzles | 4 per fuel (numbered 1-4 in the notebook). **Nozzles 1 and 2 are not in use** on either fuel; 3 and 4 do all the selling (D30) |
| Shifts | A 6 AM-2 PM, B 2 PM-10 PM, C 10 PM-6 AM. Business day starts 6 AM; Shift C after midnight belongs to the day it started |
| Prices on 15 Sep 2026 | Petrol (MS) ₹110.07/L, Diesel (HSD) ₹101.74/L |
| Tanker cost 15 Sep | ₹13,88,011 for 14,000 L HSD = ₹99.14/L (so roughly ₹2.60/L gross margin on diesel) |
| Volume | HSD ~200 KL a month (above 600 KL a year); MS below 600 KL a year. Diesel is the business: on 15 Sep diesel was 96% of sales value |

## 2. How the pump keeps its books today

**Two notebooks** (D21):
1. **Shift notebook:** at every shift change (6 AM, 2 PM, 10 PM) the meters are read and the shift's money is collected and counted.
2. **Day-summary notebook** (the one we have photos of): the shift figures are added up into one day, on 4 pages.

Plus some Excel sheets. Mismatches used to be spotted about 10 days late, with no way to tell which shift or person caused them. That is the problem PumpHisaab solves.

### The day-summary notebook, page by page (15 Sep 2026)

**Page 1: stock and meters**
- `MS Op. Stock 7071`: the **IOCL book stock** (DSR), not a dip. It has drifted far from reality (2,534 L above the MS dip, 4,528 L above the HSD dip) (D22).
- `MS Op. Dip 55.2 = 4537`: opening dip in cm = litres from the chart (rounded to whole litres).
- `MS Cl. Dip 53.2 = 4307`: closing dip.
- `(−) 230`: sold as per tank (opening − closing).
- `HSD Op Dip 59.8 = 5074 + 14000 = 19074`: opening dip plus tanker.
- Side note `−28`, `+13972 = 23574`: the tanker was **28 L short** (14,000 − 28 = 13,972), added to the IOCL book stock (9,602 + 13,972) (D23).
- **Received** box: tanker details (fuel, litres, invoice ₹, depot, invoice number, date).
- **MS Sale / HSD Sale:** per nozzle ①-④, closing written **above** opening, the sale under the line.
- **Total Sale:** add up nozzles, then `T(−) 10.00` = **testing** taken off, giving the litres really sold.
- **Circled numbers** at the bottom: litres sold as per meters and the day's **stock difference** (MS "225, −5"; HSD "6250, −75").

**Page 2: sales value, payments received, credit (part)**
- `Opening Cash Balance`: cash carried in from yesterday.
- `MS Sale: 224.80 L × 110.07 = ₹24,743.74`, same for HSD, total sale value.
- `MS/HSD Cash Sale`: the non-credit part (HSD cash litres = total − credit litres).
- **Payment Received:** customers paying **old dues or advances**, by HDFC bank transfer or **XtraPower**. Not today's fuel (D29).
- **Credit Sale** list, format: `<No>) <Customer> − <slip no>/<vehicle no> <fuel> − <litres> Rs = <amount>`. `〃` = same customer as above. `(2-5)` / `(6-31)` = subtotals.

**Page 3: credit (rest), card/UPI, expenses**
- `B/f` = **brought forward** (carry-over line from the previous page, not a slip).
- `G. Total`: all credit for the day, plus the cash given to credit customers.
- **(A) Expense POS:** what the card/UPI channels brought in: XtraPower, Paytm, card swipe (DC = debit card, CC = credit card). `Adj (−)` and `not settle` are bank-settlement adjustments; we ignore Adj and treat it as one "not yet settled" idea (D26).
- **(B) Expense (Other):** cash paid out: tiffin, DG rent, staff advance, staff food, tanker unloading, tanker driver food, cash advance to a credit customer.

**Page 4: the day balance**
- Left: opening cash + total sale + payments received.
- Right: XtraPower + Paytm + card + credit + HDFC bank + expenses + **cash in hand**.
- Both sides must be equal. **Cash in hand is the leftover figure**, worked out, not counted, in this book. It is physically counted separately (D24).

### Words and abbreviations
| Word | Meaning |
|---|---|
| MS | Motor Spirit = petrol |
| HSD | High Speed Diesel = diesel |
| Dip | Stick reading of fuel height in the tank, in cm; the chart converts it to litres |
| Op. / Cl. | Opening / closing |
| DSR / Op. Stock | IOCL's daily stock register / book stock |
| KL | Kilolitre = 1,000 L |
| T or T(−) | Testing: fuel drawn in a 5 L measure to check the nozzle, poured back into the tank |
| T.T. | Tank truck (the tanker) |
| DG | Diesel generator (rented: "DG rent") |
| B/f | Brought forward |
| 〃 | Ditto, same as above |
| Slip / memo | Credit slip from the pump's own slip book, one per fill |
| XtraPower | IOCL's fleet card for transport companies; used both for fuel and for paying dues |
| Paytm | The pump's UPI/QR app (the PRD said PhonePe; it's Paytm) |
| DC / CC | Debit card / credit card swipes on the POS machine |
| Adj / not settle | Bank settlement adjustments (ignored in v1) |
| Tiffin | Tea and snacks |
| Fooding (R+D+G) | Staff meals |
| Bakshis | Tips |
| Adv. <name> | Salary advance to a staff member |
| IOCL, OMC | Indian Oil Corporation Ltd; Oil Marketing Company |

## 3. Business learnings (what surprised us, and what changed)

| # | Learning | What we changed | Ref |
|---|---|---|---|
| 1 | Readings and cash are per shift in the shift notebook; the summary notebook only shows the day | App stays per shift, one place for everything | D21 |
| 2 | "Op. Stock" is IOCL's book stock, drifted by thousands of litres | S3 no longer compares book vs dip (it would fire daily); it flags when the **gap changes** from yesterday | D22 |
| 3 | Tankers can arrive short (28 L on 15 Sep) and the notebook still added the full invoice litres | App uses invoice − short. 15 Sep diesel difference is −47 L, not −75 L | D23 |
| 4 | The notebook works as a running cash book; cash in hand is a leftover, but it is also counted | App compares **counted** cash; opening cash in the drawer is subtracted | D24 |
| 5 | Payment channels are Cash, Paytm, Card, XtraPower, Bank transfer, Credit | Payment types changed (PhonePe → Paytm, Bank kept) | D25 |
| 6 | Card/UPI settlement has adjustments and pending amounts | Ignored in v1; manager types each machine's shift total | D26 |
| 7 | Most credit slips are **round rupee fills** (₹14,000), litres worked out and **rounded up**; a few are litre fills (420 L, 1,600 L) | Slip can be typed in ₹ or litres; litres from ₹ round up | D27 |
| 8 | Credit customers sometimes take **cash** from the pump (S.V.T. ₹11,000) | Expense type "Cash advance to credit customer" | D28 |
| 9 | Big customers pay **old dues or advances** (₹15.65 lakh on 15 Sep); 2 loyal partners pay in advance for a ₹1/L discount given later on their bill | "Payment from customer" entry, kept out of fuel sales; slips stay at full price | D29 |
| 10 | Nozzles 1 and 2 are not in use | Marked not in use: no readings, no flags | D30 |
| 11 | Slip numbers come from the pump's own books (several series: 4461-4490, 4142, 782) | A slip number can never repeat | D31 |
| 12 | Testing is random: any nozzle, any shift, usually 10 L per fuel per day | Per-shift "nozzle + litres" design kept | D32 |
| 13 | Expenses are more varied than the PRD's 4 types | 10 types, owner can add more | D33 |
| 14 | Diesel dominates, and sales volumes of petrol are tiny (225 L on 15 Sep) | A 0.5% petrol limit is ~1 L; expect petrol flags until limits are tuned on real data (Phase 8) | Watch |
| 15 | The notebook's arithmetic was right everywhere; differences come from rounding and the tanker short, not mistakes | The app's value is catching drift daily, not fixing sums | Report |
| 16 | XtraPower is IOCL's fleet card and behaves like a credit card at the machine: dues paid with it show up in the shift's XtraPower total. Bank transfers for old dues never touch a shift | Dues by card/XtraPower/Paytm/cash are taken off the shift; bank dues only recorded (27 Sep) | D47 |
| 17 | The drawer is not emptied at each shift change: the next shift starts with what was counted, unless the owner takes cash out | Starting cash prefilled from the previous count, editable (27 Sep) | D46 |
| 18 | The owner wants old days to close themselves: submitted days lock after 3 business days, but an unsubmitted day must stay fixable | Auto-lock submitted days only; warn about yesterday and the day before (27 Sep) | D49 |

## 4. Numbers from the real day (15 Sep 2026)
- Petrol: tank 229.54 L vs meters 224.80 L → **−4.74 L (−2.07%)**
- Diesel: tank 6,297.56 L vs meters 6,250.45 L → **−47.11 L (−0.75%)**
- Should have ₹6,60,664.52; credit 5,411.08 L / ₹5,50,514.80 across 29 slips (2 customers take most of it: Maa Bhawani Roadlines 25 slips, ₹3.21 lakh)
- Payments from customers ₹15,65,052; expenses ₹27,110; cash in hand ₹22,919.99
- Our digitised dip chart matched the notebook's four dip readings to within 1 litre, so the chart is right.

Full transcription: `docs/data/notebook/2026-09-15-transcription.md`. Comparison: `docs/plans/archive/phase-2-report.md`.

## 5. Product learnings (from the design walkthrough and PRD review)
- **No reasons, ever.** Asking a manager "why" slows them and reads as blame. Flags go to the owner, who calls (D3, hard rule 7).
- **Pump words, not accounting words:** Should have / Received, Sold as per tank / Sold as per meters, Difference, Flag.
- **Sign rule:** negative = loss (red, true minus sign), positive = excess (amber), zero = Matched (green).
- **Only the owner sets prices;** the manager taps Confirm each morning.
- **Canvas v2 is the final design;** the older design-system notes still mention "Add reason", red "not started" dots and "Variance": ignore those (D2, D13).
- **Owner notes, "submit yesterday first" and "None today" buttons** come from the canvas and are in v1 (D3).
- **Nothing fake in the app:** tabs show one honest "arrives in Phase N" line until built (D9).

## 6. Technical learnings (for whoever builds next)
**Read first (these bit us on the owner's phone):** keyboard never covers input (`ScreenBody`/`KeyboardSafeScroll`, test-guarded) · every `TextInput` uses `typingText` (test-guarded) · a value beside a label wraps (`flex-row flex-wrap`) · lists that grow show the 2 most used, never everything · Save-button forms keep a draft · outbox saves stay in order · `metro.config.js` changes need a Metro restart · EAS builds read env vars from EAS, not `.env`. Details below.
- **Folder map:** screens in `app/`, design components in `src/components/ui/`, maths in `src/calc/` (no React, no database), helpers in `src/lib/`, golden cases in `tests/golden/`, docs in `docs/`.
- **All limits live in `src/calc/rules.ts`.** A test fails if a limit is written anywhere else in the engine.
- **Golden cases** (`tests/golden/cases/*.json`) are the truth for the maths. Their expected answers are computed separately in Python (`tests/golden/generate.py`), not copied from the engine. This caught two engine bugs in Phase 2. Add each new notebook day there.
- **Exact decimals everywhere** (decimal.js / Postgres numeric). Round only on screen, except a credit slip's own ₹/litres.
- **Theme comes only from `docs/design-tokens.json`** via `npm run theme`; a test fails if they drift. Non-token colours or sizes don't exist in the code.
- **CI gotcha (Phase 1):** GitHub failed because `expo-env.d.ts` is generated locally and gitignored. Fixed by referencing Expo types in `nativewind-env.d.ts`. **Always check in a fresh clone before pushing.**
- **Expo Go login:** the Expo account was created with GitHub, so Expo Go (which only takes username/password) needed a password set via "Forgot password" on expo.dev.
- **Expo Go can't receive Android push** notifications, so we switch to our own development build in Phase 3.
- **Live database is never touched by code.** Every change is a migration file the owner pastes into the Supabase SQL editor (hard rule 1). CI tests migrations on a throwaway database (D16).
- **Free Supabase plan pauses projects unused for a week** and has no self-service backups: decide backups before real pilot data (open).
- **Database tests run in GitHub, not on the Mac** (no Docker here). For quick local checks Claude Code uses PGlite (an in-memory Postgres) with a small stand-in for Supabase's auth schema and pgTAP, in its scratch folder only. The truth is always the GitHub run on a real throwaway Supabase.
- **Every migration guards itself:** it refuses to run twice or out of order, and writes its name to `schema_migrations_applied`. The owner pastes them; Claude Code never touches the live project (hard rule 1, D35).
- **Golden cases also drive the database:** `npm run golden:sql` turns `tests/golden/cases` into `supabase/tests/03_golden.test.sql`; a test fails if it's out of date.
- **Web must be a single-page app** (D41): pre-rendering on the server broke because saved logins need a real browser (`window`).
- **NativeWind dark mode is "class"**: our ThemeProvider switches colours itself; "media" mode threw an error when a browser added a dark/light class.
- **Expo typed routes** only know new screens after Expo regenerates them (`expo start` or `expo export`); a fresh type check right after adding a screen can fail until then.
- **Never give a typing box (TextInput) a fixed line height:** on iPhone the typed text sits too low and is cut off at the bottom while typing (owner found it on day one). Font size only.
- **Bottom sheets must rise above the keyboard** (KeyboardAvoidingView inside the sheet's Modal); otherwise the field is hidden while typing.
- **`npx expo start` changed meaning once expo-dev-client was added:** it defaults to "development build" mode, whose QR code Expo Go and the iPhone camera can't read. Use `npm start` (Expo Go + web) or `npm run start:android-app` (our Android app).
- **Supabase "Allow new users to sign up" can look saved but not be.** Always re-test by attempting a sign-up; a test account was created on 26 Sep because of this and then deleted.
- **iPhone stays on Expo Go** (our own iPhone build needs a paid Apple account); Android gets our development build (APK from EAS).
- **Supabase keys:** the dashboard's "API URL" ends in `/rest/v1/`; the app needs only the base URL. The new "publishable key" (`sb_publishable_…`) works with supabase-js in place of the old anon key. User sign-in tokens are ES256 (new signing keys) and the Edge Function with "Verify JWT" on accepts them.
- **Live security was tested from outside** after setup (26 Sep): not signed in → nothing; a login with no pump → nothing, can't write, function refuses; sign-up refused.
- **Android:** our development app installs from an EAS link (allow Chrome to install unknown apps; Play Protect "Install anyway"). Expo Go is not needed on Android.
- **Local database check** is saved in `tools/db-local-check/` (PGlite + stand-ins), so any session can use it.
- **Numbers from Supabase arrive as JavaScript numbers** unless cast: every numeric column the app reads is selected as `column::text` so litres and rupees never pass through floating point (Phase 4).
- **Views use `security_invoker = true`** so each person's own Row Level Security applies when they read `v_business_days` / `v_tank_day` (Phase 4).
- **The database works out dip litres itself** (a trigger on `tank_readings`), stores the chart version used, and refuses a dip outside the chart (H3). Whatever litres the app sends are ignored (Phase 4).
- **Locked is worked out, not stored by a job:** a submitted day counts as locked once 3 business days old, computed from the server date each time; no scheduled job to fail (D49).
- **Golden day cases now load into real tables** in the database test (one made-up pump per case) and are checked through the SQL views; each slice checks more of the day (Phase 4).
- **Android draws edge to edge, so the keyboard no longer shrinks the window:** **Owner's rule (27 Sep): the keyboard must never cover the box being typed in, the message under it, or the next button, anywhere.** A red message that appears while typing needs a second scroll (content-size change), found on Shift A. It happened twice in one day (Opening dip, then Sign in, where the Sign in button stayed under the keyboard). The fix now lives in one place (`KeyboardSafeScroll` / `ScreenBody` in `src/components/ui/Screen.tsx`, and `BottomSheet`), `tests/keyboard-safety.test.ts` fails if a screen skips it, and CLAUDE.md's definition of done says so. KeyboardAvoidingView alone did **not** fix it on the owner's Android phone. What works: on Android the screen body adds room under the content equal to the keyboard height and scrolls the focused box just above the keyboard (measured in window coordinates); iPhone keeps KeyboardAvoidingView (27 Sep).
- **The dev app picks up new code instantly, before the owner pastes the matching migration.** In that gap screens failed with "check the internet"; errors for a missing table/column/function now say "The app is newer than the database" (27 Sep). Paste the migration first, then save the app code, where possible.
- **The round gear button at the top right on Android is the Expo dev-client menu,** not part of the app; it won't be in the preview/pilot build.
- **"Insert or update" (upsert) re-sends every column it saves,** so a column-level UPDATE grant must include the row's keys (pump, day, shift, nozzle); the triggers stop them from really changing. A database test now saves exactly the way the app does (4b).
- **An opening has two sources:** the previous shift's closing (copied by the database) or a typed one (meter change / first reading). The app shows the copied value even before the row is saved (`openingOf()`), so the screen and the engine agree before and after saving (4b).
- **How tankers are really checked (27 Sep):** every tanker is unloaded chamber by chamber (e.g. 4 chambers: 4,000 / 4,000 / 4,000 / 2,000 L). Our tank is dipped before unloading and after each chamber, so each chamber's short is known. This is routine at the pump, not optional. The challan total is what's paid; price per litre = selling price − dealer margin (15 Sep: ₹101.74 − ₹2.60 = ₹99.14; the challan was ₹51 more than price × litres).
- **Chambers are dipped before AND after each one** (28 Sep): sometimes diesel is sold between two chambers to make room in the tank, so a chamber's "before" isn't always the previous chamber's "after". The tanker's total rise is the chambers' rises added up.
- **Margin belongs to the owner, with the price** (28 Sep): managers confirm the selling price; the owner sets the dealer margin. Invoice price per litre = selling price − margin.
- **Android clips the top of big typed numbers** unless `includeFontPadding: false` and centred vertical text (found on the tanker screen, 27 Sep).
- **Build one slice while the owner tests the last** (27 Sep): the owner asked to build all of Phase 4 and test once; building 4d during lunch but testing 4b-4d before 4e/4f keeps each round small, because every phone check so far found something the tests can't (keyboard, layout, wording).
- **A worked example can carry a rule change safely:** when D47 changed how bank dues count, the 15 Sep example was updated in the Python generator first, and the engine, the database and the app then had to agree with it again.
- **EAS builds use the "environment" named in `eas.json`** (development / preview / production); `EXPO_PUBLIC_*` values must be set there (`eas env:create`), the Mac's `.env` isn't uploaded. A new Android ID (the preview app) gets its own keystore, made in the cloud on the first build.
- **Changing `metro.config.js` needs a restart of the Metro server** (the dev app and web keep the old packing until then).
- **An over-the-air update only reaches apps with the same app version** (`runtimeVersion: appVersion`) on the same channel; it's downloaded on one launch and shown on the next.
- **Pop-up sheets (Modal) need the theme's colour variables again on web** (they render outside the app's root): `BottomSheet` applies `cssVars[scheme]`. Without it, on web the sheet's borders turned black and selected states vanished (03 Oct).
- **Order matters for over-the-air updates that need a database change:** the owner pastes the migration first, then the update goes out. Otherwise the app says "The app is newer than the database" (safe, but blocks the screen).
- **Managers read example text as typed text** (03 Oct demo): placeholders must be very light and start with "e.g."; single choices must not look like chips.
- **A pill or value beside a label must be allowed to wrap** (owner, 29 Sep: "Short −10,339.72 L (−88.48%)" ran off the Review card). Rows with a label and a DifferenceValue use `flex-row flex-wrap`, so a long value drops to its own line instead of being cut (part of the "text never cut off" rule, D69). Test big wrong numbers too, not only nice ones.
- **Owner's rule for lists that grow (29 Sep):** never show the whole list by default; show the 2 most used and search for the rest, with "Add new" when nothing matches (D82).
- **Dips are stored to 1 decimal (`numeric(6,1)`)**, as typed on the phone. A 2-decimal dip (only in made-up examples) is silently rounded by the database, so the database's litres differ from the engine's. Real dips never have 2 decimals; keep new worked examples to 1 decimal (28 Sep).
- **Expo Router's typed routes (`.expo/types/router.d.ts`) are made by the running dev server.** A new screen's path fails `npm run typecheck` until the dev server has seen the file (it isn't committed; CI doesn't type routes).
- **Offline saves must stay in order:** once anything waits in the outbox, new box saves queue behind it (never sent directly), else an older value could land last. Queued saves drop the row version so a retry isn't refused as "someone else changed this" (D71, D78).
- **`create or replace view` can only add columns at the end.** `v_business_days` is `d.*`, so a new `business_days` column doesn't appear in it until the view is rebuilt; migration 12's `last_submitted_at` is read from the table instead.
- **Text must never be cut off on any side** (owner's rule, 28 Sep). Android sizes a TextInput for its placeholder; when the placeholder is smaller than the typed number, the first digit (or a "0" filled in by Done) lost its top and looked like "U", while "10,000" looked fine because typing more characters re-measured it. Fix: every TextInput uses `typingText` (`alignSelf: "stretch"`, `includeFontPadding: false`, centred), so it's as tall as its box. `tests/text-clipping.test.ts` guards it. Check short values ("0", "6") as well as long ones on the phone.
- **Any form with a Save button must keep a draft** (owner, 28 Sep): the pump manager gets interrupted (a customer, a call) and presses Back. Use `useDraftLoad` / `useKeepDraft` (`src/features/day/useDraft.ts`) on every new Save-button form, and call `discardDraft()` after Save and Remove.
- **The owner's Android dev server may already be running on port 8082**; the browser preview can reuse it (`localhost:8082/gallery`).
- **Accounts:** GitHub `SubhamSamal/pumphisaab` (public), Expo/EAS `@pumphisaab/pumphisaab` (personal account `pumphisaab`), Supabase `pumphisaab` (Mumbai).

## 7. How we work (process learnings)
- **Keep the docs cheap to use** (29 Sep audit): HANDOFF.md is the only status page; decisions and learnings are searched, not read top to bottom; finished plans and owner steps go to `docs/plans/archive/`; a replaced decision is marked "(Replaced by Dxx)".
- **Give the owner all steps at once** (numbered, click by click, what to send back); one step at a time felt slow. Plans for each phase live in `docs/plans/`, and `docs/HANDOFF.md` is the start page for a new session.
- **Every phase:** plan → owner MCQs → owner says "go" → build → check → plain-language summary. Nothing is built before "go".
- **MCQs over open questions:** the owner answers fastest with 3-4 options and a recommendation; when an answer doesn't match the question, ask again with the exact text quoted (happened once with "Payment Received").
- **Real data beats assumptions:** one notebook day changed 13 decisions. Get real data before designing anything that touches money.
- **Write down what's decided** in `docs/decisions.md` the same day, and the learning here.
- **Test like CI before pushing** (fresh clone); tell the owner plainly when something failed and why.
- **Check an owner answer against the notebook before building on it** (27 Sep): "dues come separately" contradicted the 15 Sep XtraPower figures; re-asking with the exact numbers gave the precise rule (card-type dues in the shift, bank dues outside). Free-text answers often add new rules (auto-lock came this way): split them into small follow-up MCQs.

## 8. Still open
See `docs/HANDOFF.md` §2 "Still open" (kept there so there is one list). Also: whether "Adj" on XtraPower/Paytm needs its own field later (owner to check).
