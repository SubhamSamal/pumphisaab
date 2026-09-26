# Phase 2 report: calculation engine

Built 26 Sep 2026. Code: `src/calc/`. Every limit: `src/calc/rules.ts`. Test cases: `tests/golden/`.

## The formulas (what the engine works out)

**Fuel, per fuel, per day**
- Dip litres = read from the tank's chart, straight across between rows (123.4 cm = 13,215.37 L)
- Received from tanker = litres on invoice − litres short
- **Sold as per tank** = opening dip litres + received − closing dip litres
- **Sold as per meters** = Σ (closing − opening) for every nozzle in use, all shifts − litres tested
- **Difference** = sold as per meters − sold as per tank (negative = possible loss)
- Difference % = Difference ÷ sold as per tank × 100

**Money, per shift**
- **Should have** = litres sold as per meters × that day's price, for each fuel, added up
- **Received** = cash counted − cash already in the drawer at the start + Paytm + Card + XtraPower + Bank transfer + credit slips + expenses paid from this shift's drawer − customer payments of dues/advances
- **Difference** = Received − Should have (negative = short)

**Credit slip**
- Typed in ₹: litres = ₹ ÷ rate, rounded **up** to 2 decimals (as on the real slips)
- Typed in litres: ₹ = litres × rate, to the paisa

**Tanker**
- Amount = litres ordered × price; short amount = litres short × price; to pay = amount − short amount; margin = litres received × margin per litre; dip rise = litres after unloading − litres before

**Price for a day** = the latest price whose start date is on or before that day.

**Matched day** = every fuel and every shift worked out, all within limits, no hard errors.

## The rules (all in `src/calc/rules.ts`)

| Check | Rule | Starting value |
|---|---|---|
| S1 Fuel | Flag when tank vs meters Difference is beyond this % of sold as per tank | 0.5% |
| S2 Money | Flag when a shift is short or excess beyond | ₹100 |
| S3 IOCL book | Flag when (book stock − opening dip) moved from yesterday's gap by more than this % of opening dip litres | 0.5% |
| S4 Nozzle | Flag an in-use nozzle that sold nothing all day | on |
| S4 Nozzle | Flag a nozzle selling more than N × its recent daily average | 2×, over 7 days, needs at least 3 days |
| S6 Tanker | Flag litres short beyond this % of ordered | 0.3% |
| S6 Tanker | Flag when the dip rise differs from litres received by more than | 0.5% |
| S7 Opening dip | Flag when today's opening dip differs from last night's closing by more than | 0.5 cm |
| S9 Expenses | Daily cap per expense type | none set yet |
| R1 IOCL | Red flag when Difference is beyond 4% + evaporation (HSD 0.20%, MS 0.75%) | 4.20% HSD, 4.75% MS |
| Credit slip | Litres from a ₹ fill: decimals and rounding | 2 decimals, round up |
| Testing | Litres suggested for a new test row | 5 L |

**How limits are read:** "beyond" means strictly more. Exactly 0.5% or exactly ₹100 is OK.

**Hard checks (block submit, never limits):** H1 closing below opening · H2 opening ≠ last closing without owner-approved meter change · H3 dip outside the chart · H4 a Today section not done · H5 a negative number · H6 price not confirmed or missing · H7 slip number used before · H8 test litres more than that nozzle sold in the shift · H9 credit litres more than the meters sold in the shift.

**Always true:** no reason is ever asked; limits are compared on exact numbers, never rounded ones; nothing is rounded until it's shown on screen (except a credit slip's own ₹/litres, which are real document values).

## Real notebook day, 15 Sep 2026

| | Notebook | App | Why different |
|---|---|---|---|
| MS sold as per tank | 230 | 229.54 L | Notebook rounds dip litres to whole numbers |
| MS Difference | −5 | **−4.74 L (−2.07%)** | Same, rounding |
| HSD sold as per tank | 6,325 | **6,297.56 L** | App takes off the 28 L tanker short (D23) |
| HSD Difference | −75 | **−47.11 L (−0.75%)** | Same reason |
| Should have | ₹6,60,664.52 | ₹6,60,664.52 | Same |
| Credit | 5,411.08 L / ₹5,50,514.80 | 5,411.08 L / ₹5,50,514.80 | Same (with round-up) |
| Money Difference | (not worked out) | ₹0 | The notebook's cash in hand is the leftover figure, not a count |

Flags the app would raise that day: **S1 Petrol short 4.74 L (2.07%)**, **S1 Diesel short 47.11 L (0.75%)**. No hard errors.

Notebook arithmetic: every total adds up. One note: HSD cash sale ₹85,405.98 is total HSD minus credit (correct); 839.37 L × ₹101.74 would give ₹85,397.50. The ₹8.48 gap comes from rounding litres on round-rupee credit slips, not from a mistake.

## Bugs the tests caught before they reached you
1. An unconfirmed price raised the H6 error twice. Fixed.
2. When test litres were more than a nozzle's sale, H9 (credit over meters) fired even with no credit slips. Fixed: H9 only looks at shifts with credit slips.

## Test count
65 automatic tests, including 28 golden case files (PRD examples 1-8, every hard and soft check at its limit, the canvas sample day, and the real 15 Sep day). Expected answers are computed separately in Python (`tests/golden/generate.py`), not copied from the engine.
