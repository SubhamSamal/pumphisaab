# Phase 5a: daily fixes from the pilot (plan, 20 Oct 2026)

Status: **plan; waiting for the owner's MCQ answers and "go".** Owner's answers so far (20 Oct): split Phase 5 into 5a and 5b (D112); Fuel prices screen and the fuel trend move into 5a (D113); "set up a second pump" moves from Phase 6 to v2 (D114); staff-wise entry = who sold on which nozzle (D115).

**Why 5a first:** these are the things the managers and the owner feel every day. All of 5a goes **over the air** (Preview → owner checks → production), **no reinstall**. One migration (16), pasted by the owner before the update that needs it. 5b (owner loop + push, one reinstall) comes after.

## What 5a builds, in 3 slices (each slice ships to Preview on its own)

### Slice 1 — Prices, fuel trend, real days as tests (no migration)
1. **Profile › Fuel prices** (owner only). A list of prices per fuel, newest first, with the start date and the dealer margin. "Add new price": fuel, ₹ per litre, margin, starts on (today or later). The app never changes an old price; a new price starts on its date (hard rule 10). Managers keep tapping Confirm each morning. The database already lets only the owner add prices, so no migration.
2. **Dashboard › Fuel trend** (owner only, D109). The last 30 business days, one row per day per fuel: Sold as per tank, Sold as per meters, **Difference** in L, % and about ₹, coloured by the sign rule. At the top, the month total per fuel ("Petrol: −142 L this month, about ₹15,630"). Only submitted days count; others show "not submitted". Tap a day to open its Review. Reads the database view `v_day_match` (the final truth), so it shows the same numbers as Review.
3. **01-05 Oct as golden cases.** The 5 real, checked days become tests in both places (`src/calc/` and the SQL views). Any future formula change must give exactly those days' numbers.

### Slice 2 — Nozzle checks and staff on nozzles (migration 16)
4. **Nozzle test: "The 5 L measure got"** (D110). In Testing, each test row gets a second box beside "Meter showed". The app works out the nozzle's error (`measure − meter`, and as %), shown red/amber beyond IOCL's ±25 mL per 5 L (0.5%, a pump setting). Optional box: old days don't change. Flag S10 "nozzle measure off" (stored as a flag in 5b; shown on Review in 5a). Same maths in SQL (view `v_nozzle_checks`), with worked examples in the golden cases. Per-nozzle history on Dashboard › Fuel trend.
5. **Who sold on which nozzle** (D115). On each shift, every in-use nozzle row gets a "Who" pick from the shift's attendants. Review shows litres and ₹ per attendant for the shift; Fuel trend shows each nozzle's checks with who was on it, so a nozzle (or person) that's off every day stands out.

### Slice 3 — UI audit 1 (D103-D106) and "not settled" (migration 16)
6. **Today:** a teal "Next" tag on the first card not done; done cards fold to one line (D104).
7. **Opening dip:** the dip first, "IOCL stock (DSR), optional" second.
8. **Sales (one shift):** numbered parts (1 Cash · 2 Paytm, cards… · 3 Credit slips · 4 Customer payments), each with a small done tick, and a slim money bar always at the bottom ("Received ₹58,383 · Difference −₹6,022") (D105). "Cash at start" shown as a line with "Change", not a box.
9. **Tanker:** two steps, 1 Challan → 2 Chambers; price chips move to the totals; invoice date shown as "today · Change" (D106).
10. **"Not settled yet"** box per payment type per day on Sales › By type, shown on Review; never changes Should have / Received (D103).
11. A short green "Saved" tick next to the box just left.
12. Plainer words: "Should have (by meters)", "IOCL stock (DSR)", "Was any nozzle tested (5 L check)?", "A meter reading needs your OK", error lines that say what to type.
13. Bigger outlined buttons for "Remove last / Add another / Start again"; number pad "Next" through cash and payment boxes; vehicle no. on each slip row.

## Migration 16 (one file, the owner pastes it before slice 2 goes to Preview)
**DATA SAFETY: ADDS ONLY. No DROP, no TRUNCATE, no row changed.**
- `nozzle_tests.measured_l`: new, empty column (ALTER TABLE … ADD COLUMN).
- `nozzle_readings.staff_id`: new, empty column (who sold on the nozzle that shift; must be one of the shift's attendants).
- **New table `settlement_pending`** (day, payment type, ₹) with the standard columns, RLS and audit trigger (owner agreed in D103; asking again per CLAUDE.md since it's a new table).
- View `v_nozzle_checks`; `rules.testing.measureFlagBeyondPercent` default 0.5.
- pgTAP tests for each; refuses to run twice or out of order.

## Not in 5a
- **Phase 5b (next):** flags stored and sent, bell, unlock request, owner notes, edit-after-submit alert, change history; push notifications + "day not submitted" reminder (one reinstall of the app; Firebase setup by the owner, click by click).
- **"Sold as per sales amount"** per fuel: waiting for the owner's formula (Q5).
- **Other sales (lubes, gas stove/cylinders):** came up in the 6-19 Oct notebooks (Q4).
- Odia/Hindi labels: ask the managers first.

## Checks for every slice
typecheck, lint, all tests (incl. keyboard-safety and text-clipping); database tests locally and in CI; golden cases in both places; new parts in `/gallery`; light and dark at 390 px; the owner checks on PumpHisaab Preview before production.

## MCQs (recommended first)
**Q1. Who sold on which nozzle: how many people per nozzle per shift?**
- A (recommended): one person per nozzle per shift (the one mostly on it).
- B: several people per nozzle, each with their own meter reading when they hand over (more typing, more exact).

**Q2. Where should "per attendant" show?**
- A (recommended): Review (litres and ₹ per person for each shift) + Fuel trend (each nozzle's checks with who was on it).
- B: Review only.

**Q3. Fuel prices screen: can managers see it?**
- A (recommended): managers see the list (read only), only you add.
- B: owner only; managers see only today's price strip as now.

**Q4. Other sales (lubes, gas stove, cylinder refill)?**
- A (recommended): plan it in 5b: a per-shift "Other sales ₹" line that adds to Should have (a formula change, so golden cases in both places).
- B: add it to 5a slice 3.
- C: later (Phase 6 or v2).

**Q5. "Sold as per sales amount" per fuel?**
- A (recommended): you send the formula + one worked day; it goes into 5b.
- B: you send it now and it joins 5a slice 1.
- C: drop it.

**Q6. Order of the slices?**
- A (recommended): 1 Prices + trend → 2 Nozzle checks + staff → 3 UI audit.
- B: 3 UI audit first (managers feel it most), then 1, then 2.

## Owner steps (after "go"; given click by click at each slice)
1. Slice 1: open PumpHisaab Preview, check Profile › Fuel prices and Dashboard › Fuel trend; say OK → Claude sends it to the managers.
2. Slice 2: paste migration 16 in Supabase (before the update); check Testing and "Who" on Preview; OK → managers.
3. Slice 3: check Today, Sales, Tanker on Preview with a manager; OK → managers.
