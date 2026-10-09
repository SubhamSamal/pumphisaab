# Pilot fixes, round 1 (owner's demo feedback, 03 Oct 2026)

Status: **shipped to production over the air 09 Oct 2026 (update 01a1206), with the owner's round-1 check (D107, D108)**
Delivery: **all over the air** (no reinstall): app changes go to PumpHisaab Preview first, the owner checks, then to PumpHisaab. Database changes come as one migration (14) the owner pastes before the update.

## Done right away (before this plan)
- **#9 First day = 1 Oct.** One-off fix file `supabase/fixes/2026-10-03-first-day-1-oct.sql`: sets the first day to 01 Oct 2026 and removes the empty days before it (only days with nothing typed; anything typed is kept and listed). Owner pastes it now; Submit then works from 1 Oct.

## Answers (no build needed)
- **#1.1 Sold between two chambers: already handled.** Each chamber has its own dip before and after, so the tank's rise per chamber ignores what was sold in between. The day's fuel check uses the challan (ordered − short), not the dips, and the meters record every sale whenever it happens. Only the dip check per chamber (S6) uses the dips, and it's right because each chamber is measured on its own.
- **#7 Staff profile for shift-wise entry:** next phase, as the owner said.
- **#10 Who changed what:** yes, every save, edit and delete is in the audit log with the person, time, old and new value. Nobody can change or delete the log.

## What I'll build
### A. Tanker finished the next day (#1.2)
- **Problem:** 3 chambers unloaded on Day 1 (Shift B/C), 2 on Day 2 (Shift A). Today the whole tanker counts on Day 1, so Day 1 looks short (2 chambers "sold" that are still in the tanker) and Day 2 looks excess.
- **Fix:** on the tanker screen, one switch under the chambers: **"Unloading finished next day (after 6 AM)"**, and **"from chamber [3 ▾]"** (Q1). Off by default, so normal days look exactly as now.
- **Maths:** Day 1 receives the chambers unloaded that day; Day 2 receives the rest. The challan's short is taken off on the day unloading started. The tanker's totals and the dip check stay on the tanker (whole challan).
- Day 2's Tanker card says "From 03 Oct's tanker OD02CD9087: chambers 4-5, 6,000 L". Review's fuel numbers include it.
- Same maths in the app and the database (hard rule 4) with a new worked example (tanker split across two days).

### B. Emergency sale while unloading (#1.3) — see Q2
Recommended: no new box. The sale is on the meters as always, so the day's totals stay right; only that chamber's dip check shows **yellow** ("tank went up 40 L less than the chamber"), which the owner sees and knows why. Operational rule: avoid it; if it happens, tell the owner.

### C. No more chips for "pick one" (#2)
- New **drop-down box** (tap → a list opens from the bottom → tap one → the box shows it, with a tick). Used for: testing nozzle, expense "where did the money come from", customer payment "how was it paid". Shift (A/B/C), fuel and ₹/litres stay as the 2-3 button switch (clearly one choice).
- **"Who worked" becomes a tick list** (one row per person with a tick box): clearly "tick everyone who worked".

### D. Instant ticks (#3)
- Ticking "who worked" (and any tick or toggle) changes **at once** on screen; the save runs quietly behind. If the save fails the tick goes back and a message says why. No more double taps.

### E. Card split (#4) — see Q3
Payment types become **Debit card** and **Credit card** (on every shift's sales, By type, customer payments).

### F. Faded hints (#5)
- Example text inside empty boxes (like "OD05AB1234") looked like something already typed, so managers pressed back to delete it. Example text becomes much lighter and starts with "e.g." ("e.g. OD05AB1234"); helper lines under boxes get lighter too.

### G. Credit slip order (#6)
Slip number first, then vehicle number.

### H. Nozzles 1 and 2 (#8) — see Q4
Owner can switch any nozzle on or off: Profile › **Nozzles** (owner only). A nozzle switched on appears on every shift from that day; its first opening is typed (cold start, already tested).

### I. Managers go back 10 days (#10)
Managers can open today and the **10 days before** (was 2). Kept as one pump setting (`rules.managerDaysBack`), read by both the app and the database. Locking stays: a submitted day locks 3 days after its date; days never submitted don't lock. Owner unchanged (a year back).

## Database (migration 14, adds things only)
- `receipt_chambers.next_day` (A) and the per-day "received" view, `v_day_match` updated.
- `open_day()` reads `managerDaysBack` from the pump's rules (I); the pilot pump's rules get `managerDaysBack: 10`.
- Payment types: rename Card → Debit card, add Credit card (E, per Q3).
- (H needs no change: the owner may already switch nozzles.)

## Checks
Engine + golden case for the split tanker, database tests (split tanker, 10-day window, card types), keyboard/text tests, typecheck, lint, CI; gallery for the new drop-down and tick list. Then over the air: Preview → owner checks → production.

## Owner answers
- **D97** Split tanker: one switch "Unloading finished next day" + "from chamber N" (Q1). Short counted on the day unloading started.
- **D98** Emergency sale during unloading: no new box; the chamber's dip check shows yellow; rule for managers: avoid, tell the owner (Q2).
- **D99** Card → Debit card (past amounts move with it), plus Credit card (Q3).
- **D100** Nozzles: the owner switches them on/off in Profile › Nozzles (Q4).
