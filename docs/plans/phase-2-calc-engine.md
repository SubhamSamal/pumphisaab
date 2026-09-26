# Phase 2 plan: Calculation engine + golden cases

Status: **plan, waiting for owner "go"** · Written 26 Sep 2026 · Estimate 3-4 working days (+ notebook cases once transcribed)

## Why this phase comes first
The maths is the product. If "sold as per tank", "sold as per meters" or "Difference" is wrong by even a litre, the app loses the owner's trust on day one. Building it first, with no screens and no database, lets us prove every formula against the PRD and the real notebooks, and tells us exactly what the database must store (Phase 3).

## What gets built
All of it is pure TypeScript in `src/calc/` (no React, no Supabase), using `decimal.js` for every litre and rupee. Nothing is rounded inside the engine; rounding happens only on screen (CLAUDE.md hard rule 3).

| File | What it does |
|---|---|
| `src/calc/types.ts` | The inputs and outputs of a business day, as plain data (decimal strings in, Decimals out) |
| `src/calc/dipChart.ts` | Checks an uploaded chart (numbers only, both columns go up row by row, duplicates removed, 0 cm = 0 L added if missing) and converts dip cm → litres by straight-line reading between rows. Outside the chart = H3 |
| `src/calc/prices.ts` | Price for a business date = latest price with start date on or before that date (hard rule 10). No price or not confirmed = H6 |
| `src/calc/meters.ts` | Per nozzle: sale = closing − opening. Per shift and product: gross meter litres, test litres, **sold as per meters** = gross − tests. Checks H1, H2, H8 |
| `src/calc/tank.ts` | Per product: **sold as per tank** = opening dip L + received net L − closing dip L (summed over that product's tanks). **Stock Difference** = sold as per meters − sold as per tank, and Difference % = Difference ÷ sold as per tank |
| `src/calc/money.ts` | Per shift: **Should have** = Σ (sold as per meters × that day's price). **Received** = cash (note count × value + coins) + PhonePe + POS + XtraPower + Bank transfer + credit + expenses paid from that shift's drawer. **Difference** = Received − Should have |
| `src/calc/credit.ts` | Credit slip amount = litres × today's rate. Checks H7 (slip used twice) and H9 (credit litres more than meter litres) |
| `src/calc/tanker.ts` | Per receipt (PRD F4): received net, amount, short amount, total, total sales amount, profit, dip check after unloading. Check S6 |
| `src/calc/checks.ts` | Every hard check (H1-H9) and soft check (S1, S2, S3, S4, S6, S7, S9, R1) as a small function returning a code, the numbers behind it and a plain-English message. S8 (edit after submit) is an event, so it lives in the database in Phase 5 |
| `src/calc/day.ts` | `evaluateDay(input)`: runs everything and returns per-product tank vs meters, per-shift money, all flags, all hard errors, and **is the day Matched** |
| `src/calc/explain.ts` | The written-out sums the screens show, e.g. "Opening 14,820 + tanker 11,980 − closing 18,681 = 8,119 L" (canvas Flow 3) |

A day is **Matched** when every product's Difference % and every shift's money Difference are within the owner's limits and there are no hard errors (PRD F10).

## Rules I will apply (my defaults; tell me if any is wrong)
1. **"Beyond the limit" means strictly more than it.** A difference of exactly 0.5% or exactly ₹100 is OK; 0.51% or ₹100.01 raises the flag.
2. **Limits are compared on exact numbers**, never on rounded display values.
3. **If sold as per tank is 0** (no fuel left the tank) but the meters show sales, the percentage can't be worked out, so S1 is raised whenever the litres difference isn't zero.
4. **H9 compares credit litres with sold as per meters after testing** (fuel that really left), per product per shift.
5. **H8 compares test litres with that nozzle's gross meter sale** in that shift.
6. **S4 spike check needs at least 3 earlier days** for that nozzle; with less history only the "sold 0 L" half runs.
7. **Money limit is per shift** (₹100 default). The day total is shown but not separately limited (as in the PRD).
8. **Shift C belongs to the day it started** (already built in `businessDay.ts`).

## Golden cases (`tests/golden/`)
One JSON file per case, holding the inputs, the expected results and where the case came from. The Vitest runner checks every file against the engine; in Phase 3 the same files drive the database tests, so both engines must agree (hard rule 4).

Planned cases (30+):
- **Dip chart (8):** 0 cm, 1 cm, 123.0 cm = 13,163.73 L, 123.4 cm = 13,215.37 L (PRD 1), 128.5 cm = 13,870.76 L, 209.9 cm, 210.0 cm = 21,628.93 L with no error, 210.1 cm = H3; plus chart checks (duplicate row, litres going down, missing 0 row)
- **PRD acceptance 2-8 (7):** sold as per tank 7,995 L; meters 8,005 − 10 test = 7,995 L, HSD Matched; MS Should have ₹1,50,490.00 vs note-count cash etc. = Difference ₹0; Tiffin ₹300 from Shift A drawer; tanker ₹8,50,000 / ₹4,250 / 9,950 L / ₹29,850; −42 L on 8,000 L = −0.53% and S1; 1 Oct price not used on 30 Sep
- **Hard checks (7):** H1, H2, H3, H5, H6, H8, H9
- **Soft checks and limits (8):** S1 at exactly 0.5% (no flag) and just over (flag); S2 at ₹100 and ₹100.01; S3; S4; S6 short and dip check; S7; S9; R1
- **Full days (3+):** a clean matched day, the canvas sample day (HSD −42 L, Shift B −₹1,250, Shift C +₹300), and a day with a mid-day tanker
- **Your notebook week (7):** each real day, entered as a full-day case; the expected values are worked out by hand and checked against what the notebook says. Any place the notebook's own arithmetic is off is listed for you, not hidden

## What you get at the end
- The engine and 30+ passing golden cases, running in GitHub checks on every push
- `docs/plans/phase-3-schema-draft.md`: the exact list of things the database must store, taken from what the engine needs
- A short plain-English report: every formula, and any notebook day that didn't match and why

## Not in this phase
Screens, the database, SQL views (they come with each slice in Phases 3-4), and S8 (edit after submit).

## Exit check
- 100% of golden cases pass (PRD cases + canvas day + notebook week)
- Typecheck, lint, tests green on GitHub
- You've read the notebook comparison report and agree with any differences found
