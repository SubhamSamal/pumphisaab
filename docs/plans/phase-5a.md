# Phase 5a: daily fixes from the pilot (plan, 20 Oct 2026)

Status: **Part 1 in production 21 Oct (01a15e4). Part 2 built 21 Oct** (migration 17 + Check for update, D122-D123; on Preview). **Part 1 built 20 Oct** (migration 16 + app; on Preview for the owner to check; real-day golden cases 02-05 Oct still to add, 01 Oct needs a read-only export). Parts 2-3 next. Decisions D112-D121.

**Why 5a first:** these are the things the managers and the owner feel every day. All of 5a goes **over the air** (Preview → owner checks → production), **no reinstall**. Three parts, in this order (owner, Q6), each with its own small migration, pasted by the owner before the update that needs it. 5b (owner loop + push, one reinstall) comes after.

## Part 1 — Prices, fuel trend, time per shift, real days as tests (migration 16)
1. **Prices: "Confirm" or "Price is different"** (D119, hard rule 10 changed by the owner).
   - Today's price strip gets two buttons. **Price is different:** the manager types the price per litre they see (IOCL message/display), starting today by default. The margin stays the owner's.
   - The owner sees "New price waiting for your OK" on Today and in Profile › Fuel prices; taps **Approve** (the price is added with its start date) or **Keep old price**.
   - While it waits: managers keep typing; Should have / Difference and **Submit wait** for the owner's answer (D120). After the answer, the manager taps Confirm on the price the day will use.
   - In 5b the request also comes as a push and in the bell.
2. **Profile › Fuel prices.** Everyone sees the list (newest first: fuel, ₹/L, starts on, margin). The owner adds a price any time (used straight away from its start date) and approves or rejects managers' requests. Old prices never change (a new price starts on its date).
3. **Dashboard › Fuel trend** (owner only, D109). Last 30 business days, per fuel: Sold as per tank, Sold as per meters, **Difference** (L, %, about ₹), coloured by the sign rule; month total on top; only submitted days count; tap a day to open Review. Reads `v_day_match`, so it matches Review.
4. **Time per shift** (read only, D116). A query the owner pastes once: for each real shift since 01 Oct, minutes from the first entry to Done, and the slowest part (meters, sales, slips…). Tells us where to make the app faster before Phase 7a.
5. **01-05 Oct as golden cases** in both places (`src/calc/` and the SQL views).

**Migration 16 — DATA SAFETY: ADDS ONLY.** New table `price_requests` (day, fuel, ₹/L, starts on, status waiting/approved/kept, who asked, who answered) with the standard columns, RLS (managers add; only the owner answers) and audit trigger (owner OK, 20 Oct). Approving adds a normal `fuel_prices` row; `submit_day()` refuses while a request for that day waits. pgTAP tests.

## Part 2 — Nozzle checks and who was on each nozzle (migration 17)
6. **Nozzle test: "The 5 L measure got"** (D110). Second box beside "Meter showed"; the app shows the nozzle's error (`measure − meter`, and %), red/amber beyond ±25 mL per 5 L (0.5%, a pump setting). Optional (old days unchanged). S10 "nozzle measure off" shown on Review (stored as a flag in 5b). Same maths in SQL (`v_nozzle_checks`) with golden cases. Per-nozzle history in the Fuel trend.
7. **Who was on which nozzle** (D115, D121). Each shift, each in-use nozzle gets a "Who" pick from the shift's attendants (one tap now). Review shows litres and ₹ per person; the Fuel trend shows each nozzle's checks with who was on it.
   - **Built to grow (owner, Q1):** stored as its own list (shift, nozzle, person, optional handover reading), so later several people can work one nozzle in a shift, each with their own meter reading, without redoing anything.

**Migration 17 — DATA SAFETY: ADDS ONLY.** `nozzle_tests.measured_l` (new, empty column); **new table `nozzle_attendants`** (shift, nozzle, staff, optional handover reading; the person must be one of the shift's attendants) with standard columns, RLS and audit (owner OK, 20 Oct); view `v_nozzle_checks`; rule `testing.measureFlagBeyondPercent` = 0.5. pgTAP tests.

## Part 3 — Easier screens (UI audit 1, D103-D106) and "not settled" (migration 18)
8. **Today:** teal "Next" tag on the first card not done; done cards fold to one line.
9. **Opening dip:** dip first, "IOCL stock (DSR), optional" second.
10. **Sales (one shift):** numbered parts (1 Cash · 2 Paytm, cards… · 3 Credit slips · 4 Customer payments) with done ticks; a slim money bar always at the bottom; "Cash at start" as a line with "Change".
11. **Tanker:** two steps, Challan → Chambers; price chips in the totals; invoice date "today · Change".
12. **"Not settled yet"** per payment type per day on Sales › By type and Review; never changes Should have / Received.
13. Short green "Saved" tick by the box just left; plainer words ("Should have (by meters)", "IOCL stock (DSR)", "Was any nozzle tested (5 L check)?", "A meter reading needs your OK", errors that say what to type); bigger outlined buttons; keyboard "Next" through cash and payment boxes; vehicle no. on slip rows.

**Migration 18 — DATA SAFETY: ADDS ONLY.** New table `settlement_pending` (day, payment type, ₹) with standard columns, RLS and audit (D103). pgTAP tests.

## Later (owner, 21 Oct)
- Polish the fuel trend graphs (owner: "the graphs can be optimised later on").

## Moved to 5b (owner, 20 Oct)
- **Other sales** (lubes, gas stove, cylinder refill): a per-shift "Other sales ₹" line that adds to Should have; formula change, golden cases in both places.
- **"Sold as per sales amount"** per fuel: the owner sends the formula + one worked day.
- Flags stored and sent, bell, unlock request, owner notes, edit-after-submit alert, change history; push + "day not submitted" reminder (one reinstall; Firebase setup by the owner).

## Checks for every part
typecheck, lint, all tests (incl. keyboard-safety and text-clipping); database tests locally and in CI; golden cases in both places; new parts in `/gallery`; light and dark at 390 px; the owner checks on PumpHisaab Preview before production. Low-end Android in mind (D117): light screens, no heavy animations.

## Owner steps (given click by click at each part)
1. Part 1: paste migration 16 → check Preview (price strip, Profile › Fuel prices, Dashboard › Fuel trend) → paste the time-per-shift query and send the result → OK → managers.
2. Part 2: paste migration 17 → check Testing and "Who" on Preview → OK → managers.
3. Part 3: paste migration 18 → check Today, Sales, Tanker on Preview with a manager → OK → managers.

## Owner answers
Q1 one person per nozzle now, built for several (D121) · Q2 Review + Fuel trend · Q3 managers can enter a price, owner approves (D119); while waiting, money check and Submit wait (D120) · Q4 other sales in 5b · Q5 formula in 5b · Q6 order 1 → 2 → 3 · time-per-shift query in Part 1 · new tables `price_requests`, `nozzle_attendants` (and `settlement_pending`, D103) approved.
