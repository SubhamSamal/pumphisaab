# PumpHisaab: Learnings and knowledge transfer (KT)

Everything we've learned about the pump, the notebooks, the product and the build, in one place.
Anyone new to the project (a person, or Claude Code in a new session) should be able to read this and understand how the pump really works and why the app is built the way it is.

- **Decisions** (what we chose) live in `docs/decisions.md` (D1, D2 …). This file explains the **why** and the **how things really work**, and points to the decisions.
- **Keep it growing:** every new notebook day, owner answer or surprise gets added here, newest learnings at the end of each section, with the date.

Last updated: 26 Sep 2026 (Phase 3 build)

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

## 4. Numbers from the real day (15 Sep 2026)
- Petrol: tank 229.54 L vs meters 224.80 L → **−4.74 L (−2.07%)**
- Diesel: tank 6,297.56 L vs meters 6,250.45 L → **−47.11 L (−0.75%)**
- Should have ₹6,60,664.52; credit 5,411.08 L / ₹5,50,514.80 across 29 slips (2 customers take most of it: Maa Bhawani Roadlines 25 slips, ₹3.21 lakh)
- Payments from customers ₹15,65,052; expenses ₹27,110; cash in hand ₹22,919.99
- Our digitised dip chart matched the notebook's four dip readings to within 1 litre, so the chart is right.

Full transcription: `docs/data/notebook/2026-09-15-transcription.md`. Comparison: `docs/plans/phase-2-report.md`.

## 5. Product learnings (from the design walkthrough and PRD review)
- **No reasons, ever.** Asking a manager "why" slows them and reads as blame. Flags go to the owner, who calls (D3, hard rule 7).
- **Pump words, not accounting words:** Should have / Received, Sold as per tank / Sold as per meters, Difference, Flag.
- **Sign rule:** negative = loss (red, true minus sign), positive = excess (amber), zero = Matched (green).
- **Only the owner sets prices;** the manager taps Confirm each morning.
- **Canvas v2 is the final design;** the older design-system notes still mention "Add reason", red "not started" dots and "Variance": ignore those (D2, D13).
- **Owner notes, "submit yesterday first" and "None today" buttons** come from the canvas and are in v1 (D3).
- **Nothing fake in the app:** tabs show one honest "arrives in Phase N" line until built (D9).

## 6. Technical learnings (for whoever builds next)
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
- **iPhone stays on Expo Go** (our own iPhone build needs a paid Apple account); Android gets our development build (APK from EAS).
- **Accounts:** GitHub `SubhamSamal/pumphisaab` (public), Expo/EAS `@pumphisaab/pumphisaab` (personal account `pumphisaab`), Supabase `pumphisaab` (Mumbai).

## 7. How we work (process learnings)
- **Every phase:** plan → owner MCQs → owner says "go" → build → check → plain-language summary. Nothing is built before "go".
- **MCQs over open questions:** the owner answers fastest with 3-4 options and a recommendation; when an answer doesn't match the question, ask again with the exact text quoted (happened once with "Payment Received").
- **Real data beats assumptions:** one notebook day changed 13 decisions. Get real data before designing anything that touches money.
- **Write down what's decided** in `docs/decisions.md` the same day, and the learning here.
- **Test like CI before pushing** (fresh clone); tell the owner plainly when something failed and why.

## 8. Still open
- Cash handover: confirm the drawer is counted including opening cash, and opening cash is subtracted.
- Confirm machine totals (Paytm, card, XtraPower, bank) include customers' dues payments, which the app then takes off.
- Backups: Supabase Pro vs nightly copy (before Phase 5).
- Whether "Adj" on XtraPower/Paytm needs its own field later (owner to check).
- 6 more notebook days to turn into golden cases.
- Android phone check in Expo Go.
