# Phase 4 plan: Daily entry, slice by slice

Status: **plan written 27 Sep 2026; MCQs answered (D45-D52); waiting for the owner's "go"** · Estimate 10-12 working days (+ about 15 minutes of owner steps per slice)

## Goal in one line
At the end of this phase, a manager fills a **whole real day on the phone** (price, dips, tanker, 3 shifts of meters and testing, all money, credit slips, expenses, closing dip), sees **sold as per tank vs sold as per meters vs money received** match live, and **submits** it. A real notebook day typed into the app gives the same totals as the notebook, in under 20 minutes.

Not in this phase: stored flags, the bell, push, manager "Request unlock", owner notes (Phase 5); settings screens and dashboard (Phase 6). In Phase 4 flags are **shown** (Review screen) but not yet **sent**. Day locking itself **is** in this phase (D49).

## How each slice is built (same recipe 6 times)
1. **Migration file** with the new tables (standard columns, row version, RLS, audit trigger, DATA SAFETY header, ledger line), the hard checks that belong in the database, and that slice's part of the SQL views.
2. **Database tests** (pgTAP, in GitHub CI): structure rules, security between pumps, the hard checks, the views against the golden cases.
3. **Screen(s)** from the v2 canvas, only `src/components/ui/` parts and theme tokens; checked light and dark, 390 px and web.
4. **Wiring:** TanStack Query loads the day, `evaluateDay()` (`src/calc/`) gives instant results on screen; saves go to Supabase.
5. **Checks:** typecheck, lint, Vitest, CI green (app + database).
6. **Owner:** paste the migration, run one check query, try the slice on iPhone and Android (steps given all at once).

## The slices

### 4a. Day opens, price Confirm, opening dip
- **Tables:** `business_days` (business date, status Draft/Submitted/Locked, confirmed MS and HSD price and who/when, "no tanker", "no expenses", submitted by/at, locked by/at, is_matched), `tank_readings` (day, tank, opening or closing, dip cm, litres from the chart version used, IOCL report stock).
- **Database rules:** one day per pump per date; the business date comes from the **server** clock; dip outside the chart is refused (H3); no negative numbers (H5); nobody can change a **Locked** day.
- **Locking (D49):** a **submitted** day locks by itself once it is 3 business days old (on the morning of 05 Oct, 02 Oct and older lock). Worked out by the database from the server date, so no scheduled job is needed. A day that was **never submitted does not lock**. The owner can **Lock** or **Unlock** any day (two owner-only buttons on the day); a day the owner unlocks stays open (managers can edit it) until the owner taps Lock again. Manager "Request unlock" comes in Phase 5.
- **Opening a past day (D49):** managers can open any day that isn't locked; the owner can open any day (a date picker, owner only, for older dates like the 15 Sep notebook day).
- **Price Confirm strip** (canvas F2): today's prices from `price_for()`; the manager taps Confirm, and the prices seen are saved with the day. If the owner adds a new price for today after that, the strip asks again ("New price from today", old and new side by side). Nothing money-related is worked out before Confirm (H6).
- **Today screen** (canvas F2): 8 section cards with grey / amber / green / red states, "N of 8 done", Submit bar (disabled until 4f). Sections not built yet say so honestly.
- **Opening dip** (canvas F3): per tank, IOCL report stock (**optional**, D48; S3 runs only when it's typed) + dip cm → litres at once, "Last night's closing dip" line, amber note for S3/S7 (no reason asked).
- **Yesterday first** (D3): red banner "Submit 01 Oct first" when an earlier day isn't submitted. Only days from the pump's **first day in the app** count (a date stored on the pump; the pre-pilot clean-up script resets it).
- **Not-submitted banners (D49):** Today shows a banner for yesterday **and** the day before if either isn't submitted, so a day never drifts past the lock window unsubmitted. The push alert for it comes in Phase 5.
- Components added: price Confirm strip, date field (D14), toast. All go in the gallery.

### 4b. Shift meters and testing (A, B, C)
- **Tables:** `shifts` (day, A/B/C, start and end time from the shift template, cash already in the drawer at the start (**prefilled from the previous shift's counted cash, can be changed**, D46), sales done at), `shift_attendants`, `nozzle_readings` (opening, closing, meter change: none / pending / approved, approved by/at), `nozzle_tests` (nozzle, litres).
- **Database rules:** closing below opening refused (H1); opening that differs from the previous shift's closing is saved as **pending owner approval** (H2) and blocks submit; test litres more than that nozzle's sale refused at submit (H8).
- **Screen** (canvas F5): attendant chips (from Profile › Staff), one compact row per **in-use** nozzle (3 and 4 today; 1 and 2 hidden), opening auto from the last closing and locked, closing typed with Next jumping to the next empty box, sale worked out. "Meter changed" sheet (old vs typed, "Send to owner", no reason). Testing: nozzle + litres (default 5). "Shift finished" card: litres × price = Should have ₹.
- **Owner approves a meter change** right on that row (a simple Approve button, owner only). The full flag/alert flow comes in Phase 5.
- **Very first day:** opening meters and dips are typed once by hand (nothing earlier to copy); no H2 on that day.
- Shift C shows "Counts in 01 Oct's day. Ends 6 AM on 02 Oct."
- SQL: `v_shift_litres` (per shift, per fuel, meter litres − test litres).

### 4c. Tanker
- **Tables:** `tanker_receipts` (vehicle number, invoice number, invoice date, unload date → business day), `receipt_lines` (fuel, tank, ordered, short, price/L, margin/L, optional dip before/after).
- **Screens** (canvas F4): Tanker tab list (today + earlier), "No tanker today" switch, Add tanker (ordered + short typed; price and margin **prefilled from the last tanker**, shown as a line with Change), totals in IOCL words (Invoice amount, Short amount, To pay, Margin earned), optional dip check ("Tank went up 11,975 L, challan says 11,980 L"). S6 shown as an amber note, Save never blocked.
- The Today "Tanker" card and the day's stock maths pick up every receipt unloaded in that business day (received = ordered − short, D23).
- SQL: tanker part of `v_day_match`.

### 4d. Sales: cash note count, other types, credit slips, customer payments
- **Tables:** `shift_payments` (shift, payment type, ₹, or "None today"), `cash_counts` (shift, note, count) + coins, `credit_sales` (shift, customer, vehicle, slip no, fuel, typed in ₹ or litres, rate, litres, ₹), `customer_payments` (customer, ₹, how paid, shift) (D29).
- **Database rules:** slip number unique per pump (H7, says which customer already has it); credit litres in a shift more than that fuel's meter litres blocks submit (H9); slip ₹ ↔ litres rounding exactly as D27 (litres from ₹ round **up**).
- **Screens** (canvas F6, F15): Sales tab with **By type** and **By shift**, shift picker defaulting to the current shift. Cash note-count grid with running total; Paytm, Card, XtraPower, Bank transfer one box per shift; Credit list grouped by shift + Add slip (company searchable, vehicle upper-case, slip no, fuel, ₹ or litres, rate = today's price); "None today" on Credit, XtraPower and Bank transfer; **Done** fills empty types with ₹0. By shift: Should have / every Received line (incl. cash paid out, opening cash taken off, customer payments taken off) / Difference with Matched, Short or Excess.
- Payments from customers: a small list in Sales ("Payment from customer": customer, ₹, how, shift), kept out of fuel sales. **D47:** dues paid by Cash, Paytm, Card or XtraPower are inside that shift's total, so the app takes them off before matching; dues paid by **bank transfer** come separately (not in any shift total), so they are only recorded, never taken off. This is a formula change: the engine, the SQL view and the golden cases (incl. 15 Sep) are updated together in this slice.
- New credit customers can be added by managers right from the slip's company box (D50).
- SQL: `v_shift_match` (Should have, Received and its parts, Difference).

### 4e. Expenses
- **Table:** `expenses` (day, type, description if Other, ₹, paid from: Shift A/B/C drawer, Owner, Bank).
- **Screens** (canvas F7): list with "From Shift B cash" on each row, totals (from shift cash / by owner or bank), Add expense (type chips, amount, paid from with the one-line explanation), "No expenses today". S9 over-cap shown amber.
- Drawer expenses flow into that shift's Received in both the app and `v_shift_match`.

### 4f. Closing dip, Review, Submit, autosave and drafts
- **Closing dip** (canvas F3): dip cm → litres, "Sold today as per tank" with the sum written out; H3 typo message ("Did you mean 171.4?").
- **Review** (canvas F8): 1 Fuel (tank vs meters, Difference in L, % and about ₹, limit in L), 2 Money by shift + day total, 3 Flags the owner will see (from the engine), and the exact message the owner will get.
- **Submit** through one database function `submit_day()` that re-checks everything on the server (H2, H4, H6, H8, H9, "yesterday first") using `v_day_match` / `v_shift_match`, stores is_matched and the time, and refuses with a plain message if anything blocks. Safe to tap twice. After Submit: the canvas "Submitted" card and "Start 02 Oct". Editing a submitted day stays allowed (logged; the owner alert comes in Phase 5).
- **Autosave on leaving every box**, header shows Saved / Saving / Offline. Every save is **idempotent** (safe to retry): fixed rows (a tank's dip, a nozzle's reading) are keyed by what they are; list rows (slips, expenses, tankers) get their id on the phone, so a retry can't make a duplicate. Row versions stop two phones silently overwriting each other ("Someone else changed this, here is the latest").
- **Local drafts:** anything typed while offline is kept on the phone (AsyncStorage, already approved D11) and sent when the internet is back; killing the app and reopening keeps every saved box (PRD acceptance 20).
- **End-to-end test:** the 15 Sep 2026 notebook day typed through the real save functions on a throwaway database gives the notebook's totals (script in CI).

## Maths in two places (hard rule 4)
- The app keeps using `evaluateDay()` for instant results. Each slice adds its part of `v_shift_match` / `v_day_match` in SQL.
- `npm run golden:sql` grows so that every **day** golden case (29 files today) is loaded into real tables inside the database test and the views must give the same answers as the JSON. Any formula change updates `tests/golden/` and must pass in both.

## Hard checks in the database (hard rule 6)
| Check | Where the database stops it |
|---|---|
| H1 closing below opening | On save (constraint) |
| H2 opening ≠ last closing | On save it becomes "pending approval"; Submit refuses while pending |
| H3 dip outside chart | On save (trigger reads the tank's chart) |
| H4 section not done | Submit refuses |
| H5 negative number | On save (constraints) |
| H6 price not confirmed | Submit refuses; money views give nothing until confirmed |
| H7 slip number used twice | On save (unique per pump) |
| H8 test more than nozzle sale | Submit refuses (needs the whole shift) |
| H9 credit litres more than meter litres | Submit refuses (needs the whole shift) |
H8 and H9 are also shown red on screen the moment they happen.

## Who can do what (RLS)
- Owner and managers of the pump read and write that pump's days; nobody sees another pump.
- A Locked day can't be changed by anyone (lock itself arrives in Phase 5).
- Only the owner approves a meter change. Prices stay owner-only (managers only Confirm).
- Credit customers: managers can add them (D50), like Staff; everything else in setup stays owner-only.
- Lock and Unlock: owner only (D49).

## Also in this phase
- **Analytics hooks:** a tiny `track()` helper fires the PRD events (`day_opened`, `price_confirmed`, `section_opened`, `section_completed`, `sales_done_tapped`, `hard_error_shown`, `credit_sale_added`, `tanker_receipt_added`, `expense_added`, `day_submitted`, `field_autosaved`, `draft_save_failed`, `meter_change_requested`, `meter_change_approved`). It does nothing until PostHog is plugged in (Phase 6), so no new library now.
- **First preview build + first over-the-air update test** (D44): a standalone APK for your Android phone (no Mac needed), then a small change sent over the air. `EXPO_PUBLIC_*` values go into EAS environment variables (steps given).
- **Sentry** (D40, D52): added with the preview build at the end of the phase (one new library, `@sentry/react-native`, approved; you create a free Sentry account, steps given then).
- Docs the same day: decisions, learnings, HANDOFF, EXECUTION.

## New tables (asking before adding, as CLAUDE.md requires)
`business_days`, `tank_readings`, `shifts`, `shift_attendants`, `nozzle_readings`, `nozzle_tests`, `tanker_receipts`, `receipt_lines`, `shift_payments`, `cash_counts`, `credit_sales`, `customer_payments`, `expenses`. All from the PRD table list plus D29 (`customer_payments`). Every one gets id, pump_id, created/updated by/at, row version, RLS and the audit trigger. `flags`, `unlock_requests`, `owner_notes`, `push_tokens` wait for Phase 5.
Every Phase 4 migration **only creates** new things, except where noted in its DATA SAFETY header: 4a adds one column to `pumps` (first day in the app) and 4d adds one security rule to `credit_customers` (D50); neither changes existing rows. None drops, truncates or deletes data.

**Pre-pilot clean-up script (D45):** because we try every slice on the real pump, I'll also write one clean-up file that removes the test days (and the `manager.test` login link) before the pilot. It **deletes data**, so it is kept separate, marked in red at the top, and pasted only when you decide. The audit log can't be deleted by anyone, so the history of the test entries stays there.

## New libraries
Only Sentry (`@sentry/react-native`) at the end of the phase (D52). Any other need, I ask first.

## What you'll do in each slice (full steps given at the time)
1. Paste one migration in Supabase › SQL editor, read its warning header first; run one check query and send me the result.
2. Open the app on iPhone (Expo Go) and Android (our app) and try the slice with the numbers I give; send a screenshot of the result.
Before 4b: add the pump's attendants in Profile › Staff (they become the shift chips).
End of phase: install the preview APK; type one full notebook day with a stopwatch.

## Order and rough time
| Slice | Days |
|---|---|
| 4a Day, price, opening dip (+ Today screen, golden-in-SQL groundwork) | 2-2.5 |
| 4b Shift meters + testing | 2 |
| 4c Tanker | 1 |
| 4d Sales, cash, credit, customer payments | 2.5 |
| 4e Expenses | 0.5 |
| 4f Closing dip, Review, Submit, autosave/drafts, end-to-end test, preview build | 2-2.5 |

## Owner decisions for this phase (MCQ round, 27 Sep 2026)
- **D45** Try each slice on the **real pump**; a separate clean-up script removes the test days before the pilot.
- **D46** Drawer cash at shift start is **prefilled** from the previous shift's counted cash; the manager can change it.
- **D47** Dues paid by Cash / Paytm / Card / XtraPower are inside the shift totals and are **taken off**; dues paid by **bank transfer** come separately and are only recorded. (First answer "comes separately" was re-asked with the 15 Sep XtraPower numbers; this is the confirmed answer.)
- **D48** IOCL report stock is **optional**; S3 runs only when it's typed.
- **D49** A **submitted** day **auto-locks** once 3 business days old (05 Oct morning → 02 Oct locks). **Unsubmitted days never auto-lock**; Today warns about yesterday and the day before (push in Phase 5). Managers open any unlocked day; the owner can Lock / Unlock any day, and an unlocked day stays open until the owner taps Lock.
- **D50** Managers can add a new credit customer while adding a slip.
- **D51** One migration and one phone check **per slice** (6 rounds).
- **D52** Sentry goes in **with the preview build** at the end of Phase 4.

## Exit check
- A full real notebook day entered on the phone in under 20 minutes; totals match the notebook (and the golden case).
- Every section of Today works on iPhone, Android and web, light and dark.
- CI green: app tests + database tests including every day golden case through the SQL views.
- Hard checks H1-H9 proven in the database tests.
- A killed app keeps every saved box; offline typing is sent when the internet returns.
- Preview APK installed and an over-the-air update received.
