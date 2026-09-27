# Phase 4e + 4f plan: Expenses, Closing dip, Review, Submit, offline

Status: **plan written 28 Sep 2026; MCQs answered (D70-D73); waiting for the owner's "proceed"** · Built overnight 28→29 Sep, checked by the owner on 29 Sep.
Parent plan: `docs/plans/phase-4-daily-entry.md` (4e and 4f sections). This file replaces those two sections with the full detail.

## Goal in one line
After this, a manager can finish a **whole day**: expenses, closing dip, a 3-step Review (fuel, money, flags) and **Submit**. The database re-checks everything and records whether the day matched. Typing survives no internet, and a real notebook day gives the notebook's totals.

## What is NOT in this build (and why)
- **Flags stored and sent, the bell, push, owner notes, "Ask to unlock":** Phase 5 (as planned). The Review screen **shows** the flags and the exact message the owner *will* get.
- **Preview APK, Sentry, the over-the-air update test (D44, D52):** these need you awake (a Sentry account, an EAS build on your Expo account, installing the APK). Planned as **4g, done together** after you've checked 4e/4f. Nothing in 4e/4f needs a new app build: your phone keeps loading the code from the Mac.
- **Setting expense limits (S9 caps) and expense types in the app:** Settings screens are Phase 6. No caps are set for now (D72).

---

## 4e. Expenses (canvas F7, PRD F8, D28, D33)

### Database (migration 11 · `20260929120000_expenses.sql`, only creates things)
- **New table `expenses`:** id, pump_id, day_id, category_id (from the 10 seeded types), expense_type (FIXED / VARIABLE, copied from the type by the database, never asked), description (required for **Other**, the database refuses it empty), amount (> 0, H5), paid_from (`SHIFT_A`, `SHIFT_B`, `SHIFT_C`, `OWNER`, `BANK`), customer_id (only for "Cash advance to credit customer", D28, optional), plus the standard columns, row version, RLS (same pump only), audit trigger, and "day must be open" (a locked day can't change).
- **`v_shift_money` gets the drawer expenses:** cash paid from Shift B's drawer is added to Shift B's Received (same as the app, PRD F10). The placeholder `drawer_expenses = 0` from 4d goes away.
- **`v_day_expenses`:** per day, total from shift cash, total paid by owner/bank, and per type (for S9).
- The golden check in the database then compares **Received and Difference for the cases with expenses too** (skipped until now): the 15 Sep notebook day included.

### Screens
- **Expenses tab section on Today** (card "Expenses", done when at least one expense is added or **No expenses today** is tapped; the card shows "Done · ₹20,950").
- **Expenses list** (canvas F7): one row per expense: type (or the description for Other), second line **"From Shift B cash" / "Paid by owner" / "Paid by bank"**, amount on the right. Totals at the bottom: **From shift cash**, **Paid by owner or bank**, **Total today**. S9 over-limit shows an amber line on the row ("More than the ₹300 daily limit"), nothing to fill. **No expenses today** button when the list is empty.
- **Add expense** (a screen like Add credit slip, with the draft kept on the phone, D67):
  1. **What for:** type chips (Salary, Staff advance, Tiffin, Staff food, Bakshis, DG rent, Tanker unloading, Tanker driver food, Cash advance to credit customer, Other).
  2. **Write what it was:** only for Other (required).
  3. **Company:** only for "Cash advance to credit customer" (the same drop-down as slips, optional).
  4. **Amount** ₹.
  5. **Paid from:** Shift A / B / C cash drawer, Owner paid, Bank, with the one-line explanation from the canvas ("Money from a shift's drawer is added back to that shift's sales, so the shift won't show as short"). Default: the shift running right now.
  - Date is the business day; Fixed/Variable comes from the type (not asked).
  - Fix or **Remove** an expense by tapping it.
- **Sales › By shift** shows "Cash paid out (expenses)" in the shift's Received lines (already built in 4d, it now gets real numbers).
- Analytics: `expense_added {paid_from}`.

### Checks
- Database tests: table rules (Other needs a description, amount > 0, paid_from values, locked day refused, pump Y sees nothing), drawer expense moves Shift B from Short to Matched, S9 cap.
- Engine: already handles expenses (golden cases exist); the app wiring gets tests in `model.test.ts`.

---

## 4f. Closing dip, Review, Submit, offline

### Database (migration 12 · `20260929130000_closing_and_submit.sql`, only creates or replaces things)
- **Closing dip:** uses the same `tank_readings` table as the opening dip (kind CLOSING). No new table.
- **`v_day_match`** (hard rule 4): per day and fuel: opening dip L, received L (tankers), closing dip L, **sold as per tank**, meters L, test L, **sold as per meters**, **Difference L** and %, within the limit (S1) and the IOCL limit (R1). Same formulas as `src/calc/day.ts`.
- **`v_shift_match`** (hard rule 4): per shift: Should have, Received, Difference, within ±₹100 (S2). Built on `v_shift_money`.
- **`day_sections(day)`:** which of the 8 sections are done, worked out by the database the same way Today does (opening dips for every in-use tank, tanker added **or** "no tanker" confirmed, each shift's closings typed, every shift's sales Done, expenses added **or** "no expenses", closing dips typed).
- **`submit_day(day)`**, the only way to submit. It refuses, with one plain sentence, when:
  - the day is locked, or an earlier day (from the pump's first day) isn't submitted (**yesterday first**, D3);
  - today's price isn't confirmed (H6);
  - a section isn't done (H4): "Closing dip isn't done.";
  - anything in `day_problems` (H2 meter change waiting, H8 test more than sold, H9 credit more than sold).
  Otherwise: status **Submitted**, who and when, and **is_matched** (every fuel and every shift within limits). Safe to tap twice. **Submitting again after a change** is allowed (the result is updated, the first submit time is kept, the latest is stored too).
- **`set_no_tanker(day, yes/no)`, `set_no_expenses(day, yes/no)`:** small functions for the two "none today" answers.
- **Pre-pilot clean-up script (D45)**, a separate file `supabase/cleanup/remove-test-days.sql`: removes every test day and the `manager.test` link. It **deletes data**, is marked in red, and is **not** part of the migrations; you paste it only when you decide (before the pilot).

### Screens
- **Closing dip** (canvas F3 "End of day"): the opening dip screen, closing version. Per tank: closing dip cm → litres at once, and **"Sold today as per tank 8,119 L"** with the sum written out underneath: "Opening 14,820 + tanker 11,980 − closing 18,681". A typo gets a hint (H3): "This tank only goes up to 195.0 cm. Did you mean 171.4?" (also added to the opening dip).
- **Today:** the Closing dip card becomes real; "8 of 8 done" turns the bar green and **Review and submit** becomes teal. The bar says what's left otherwise ("Finish 2 more sections to submit").
- **Review** (canvas F8, 3 steps, one screen each, **Next** at the bottom):
  1. **Fuel:** per fuel: Sold as per tank, Sold as per meters, Difference in L with Matched / Short / Excess, "About ₹3,780 · limit is 40 L (0.5%)".
  2. **Money:** per shift: Should have, Received, Difference; then the **Day total**.
  3. **Flags the owner will see:** a plain list (Diesel short 42 L, Shift B short ₹1,250, tanker short, opening dip vs IOCL…), tap one to go to that section; the exact message: *"01 Oct submitted. Diesel short 42 L, Shift B short ₹1,250"*. If no tanker was added: **"Did no tanker come today?" Yes, none came** (one tap, recorded). Then **Submit day**.
  - Flags never block Submit; only an empty section or a red box does (PRD F12). If the database refuses, its sentence shows on top.
- **After submit** (canvas F8 last frame): "01 Oct submitted", the 3 result lines (HSD, MS, Money), "You can still fix a number until the owner locks the day", and **Start 02 Oct** (shown once 02 Oct has begun at 6 AM; before that: "02 Oct starts at 6 AM").
- **Changed after submit:** Today shows "Changed after submit" and the bar says **Submit again** (updates the result). The owner alert for it is Phase 5 (S8).
- Analytics: `day_submitted {is_matched, open_flags}`, `section_completed`.

### Offline and autosave (PRD acceptance 20; D70)
- Boxes already save when you leave them, and the header shows **Saved / Saving… / Offline**.
- **New: an outbox on the phone.** If a box can't be saved (no internet), the save waits in an outbox (AsyncStorage, D11, no new library) instead of being lost. The header shows **"Offline · 3 waiting"**. The app retries every 20 seconds, when it comes back to the front, and after any save that works; saves go out **in the order they were made**. Every save is already safe to repeat (fixed ids), so a retry can't make a duplicate.
- While offline, the box keeps showing what you typed (also after leaving the screen and coming back, and after the app is closed): the waiting value is shown on top of the last loaded one.
- **Forms with Save** (tanker, credit slip, expense, customer payment): offline Save says "No internet. What you typed is kept on this phone; tap Save when the internet is back." (the draft from D67 keeps it). They don't go in the outbox, because they're checked as a whole.
- Submit needs the internet (the database must check the whole day).

### End-to-end check (in GitHub CI, on a throwaway database)
- The golden loader already puts every worked example into real tables. It now also fills closing dips, expenses and "no tanker/expenses", **calls `submit_day`**, and checks `v_day_match`, `v_shift_match` and `is_matched` against the JSON for every day case, the **15 Sep notebook day** included.
- New database tests `10_expenses.test.sql`, `11_submit.test.sql` (every refusal reason, yesterday first, safe to tap twice, submit again after a change, locked day).

---

## Owner answers (28 Sep 2026, MCQ round)
- **D70 Offline = outbox on the phone.** Box saves wait on the phone and go out by themselves; Save forms keep a draft and ask to tap Save again. No new library, no new build.
- **D71 Two phones, same box: last save wins.** The audit log keeps both; the "someone else changed this" message comes with Phase 5 alerts. (Replaces "row versions stop two phones overwriting" in the parent plan.)
- **D72 No S9 expense limits for now.** S9 is built and tested but no type has a cap until Settings (Phase 6).
- **D73 Anyone can add any expense,** including ones paid by the owner or bank (only recorded, logged).
- Also chosen without asking (tell me to change): **Paid from** defaults to the shift running now; "Cash advance to credit customer" asks for the company (optional); after-submit edits are allowed and the bar says **Submit again**.

## Docs I'll update after the build
`docs/decisions.md` (D70 onwards), `docs/learnings.md`, `docs/HANDOFF.md` (where we stand, what to do first), `docs/EXECUTION.md` (4e/4f done, 4g next), `docs/plans/phase-4-daily-entry.md` (status), `docs/plans/phase-4-owner-steps.md` (your steps for tomorrow), `CLAUDE.md` if a rule changes, and the gallery for every new component (type chips row, review step header, outbox indicator).

## Your steps tomorrow (full click-by-click list will be in phase-4-owner-steps.md)
1. Paste **migration 11**, then **migration 12** (both only add things), run one check query each (expected: 11 and 12 migrations).
2. The quick checks from tonight's fixes: the drop-down, the "0"s, the tanker draft.
3. **Expenses** on 27 Sep: a Tiffin from Shift B cash, a Salary paid by owner; see Shift B's Received go up.
4. **Finish 27 Sep:** closing dips, Review (3 steps), Submit. Try Submit with a section empty first (refused, with the reason).
5. **The real test:** type one full notebook day (you pick which; the 15 Sep day has known totals) with a stopwatch, and compare with the notebook.
6. Airplane mode test: turn internet off, type 3 boxes, close the app, reopen, turn internet on: "3 waiting" goes to Saved.
About 45-60 minutes in all.

## Order of work tonight
1. 4e migration + tests → engine wiring → screens → checks → commit.
2. 4f migration (views, sections, submit) + tests → golden loader with submit → commit.
3. Closing dip screen → Review → After submit → Today bar → commit.
4. Outbox + offline display → commit.
5. Clean-up script, docs, owner steps → commit. CI green after every push; I don't touch the live database.

If something needs your decision in the night, I pick the safer option, write it in `docs/decisions.md` marked **"owner to confirm"**, and tell you in the morning.
