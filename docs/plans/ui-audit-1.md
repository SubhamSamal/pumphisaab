# UI audit 1: the app through a new manager's eyes (03 Oct 2026)

Status: **planned, not built: owner (09 Oct) moved it into the upcoming phases (Phase 5 plan)**. Builds on pilot fixes round 1 (`pilot-fixes-1.md`), which goes out first.
Delivery: all over the air (Preview first, then the managers' app), plus migration 15 for PhonePe and "not settled".

## Who I walked through it as
A pump manager who uses WhatsApp and YouTube but rarely fills forms on a phone. Reads English slowly, is in a hurry, is interrupted often, has big fingers, and is afraid of "breaking" something. Every screen was walked from Today, top to bottom, in the order of a real day.

## The two new points
### N1. "Not settled" on Paytm / XtraPower / card (owner, 03 Oct) — see Q1
- **What the shift box should hold:** the **machine's total for the shift** (every payment customers made on it). That's what the shift's money check needs, and it doesn't change when the bank pays later.
- **"Not settled"** is the bank side: part of that total hasn't reached the bank yet. It doesn't change whether the shift matched; it matters for the owner's money follow-up.
- **Recommended:** a small **"Not settled yet"** box per payment type for the **whole day**, on Sales › By type (under each type's day total), shown on the owner's Review. It never changes Should have / Received. One table, `settlement_pending` (day, type, ₹); migration 15.

### N2. PhonePe (optional)
Add **PhonePe** as a payment type after Paytm. Optional because **Done** fills it with ₹0 when unused, and **By type › None today** still works. (Migration 15.)

## Findings, worst first
### P1 — confusing or slowing every day (fix now)
1. **Today doesn't say where to start.** Nine cards look equal. → The first card that isn't done gets a teal **"Next"** label and a thicker border; done cards fold to one line. (Q2)
2. **Opening dip: the optional IOCL box comes first,** before the dip that's required. → Dip first, "IOCL report stock (optional)" second.
3. **Sales (one shift) is one very long page:** cash at start, 6 note rows, coins, 4-6 payment boxes, slips, customer payments, the money card, Done. People lose their place. → Numbered steps with headings **1 Cash · 2 Paytm, cards… · 3 Credit slips · 4 Customer payments**, each with a small "done" tick, and the money card stays visible as a slim bar at the bottom ("Received ₹58,383 · Short −₹6,022"). (Q3)
4. **"Cash in the drawer when the shift started"** is a box people think they must type. It's filled from the last count. → Shown as a line: "Cash at start ₹34,567 (from Shift A's count) · Change".
5. **Tanker screen asks for too much at once:** vehicle, invoice no., amount, date, per fuel ordered/short, three price chips, chamber rows with three boxes, totals. → Two steps: **1 Challan** (tanker no., invoice amount, ordered, short) → **2 Chambers** (litres, dip before, dip after). Price chips move to the totals (managers don't need them). Invoice date hidden as "Invoice date: today · Change". (Q4)
6. **Small "Saved" in the corner is easy to miss**, so people tap again or wait. → After leaving a box, a short green tick shows next to that box for a second ("Saved").
7. **Grey example text looked typed** (fixed in round 1) and **chips looked like multi-select** (fixed in round 1).

### P2 — words a layman stumbles on
8. **"Should have"** → keep (it's the app's word, rule 13) but add "(by meters)" everywhere it appears on its own.
9. **"IOCL report stock"** → "IOCL stock (DSR)", with "optional".
10. **"Testing done this shift?"** → "Was any nozzle tested (5 L check)?"
11. **"Approve new opening?"** banner on Today → "A meter reading needs your OK" (owner only).
12. **Error lines** say what's wrong but not always what to type: e.g. "More than ordered." → "Short can't be more than Ordered (14,000 L)."
13. **Shift C note** "Counts in 01 Oct's day. Ends at 6 AM on 02 Oct." → keep, it's clear.

### P3 — touch and sight
14. **Small ghost buttons** ("Remove last", "Add another nozzle", "Start again") are easy to miss. → Outlined buttons, full width where alone.
15. **Number pad "Next"** already jumps between meter boxes; extend it to the cash note rows and payment boxes so the keyboard can stay up.
16. **Long lists of slips:** each slip row shows company, slip no., ₹, litres. → Add the vehicle number (that's how managers recognise a slip).

### Not changing (works for a layman already)
Review's 3 steps and the red/yellow/green Summary; the price Confirm strip; the company drop-down with the 2 most used; drafts that come back after Back; the offline "waiting" note.

### Bigger idea (later, not this round) — see Q5 notes
**Odia / Hindi labels.** All words live in the screens today; moving them into one word list would let us switch language. About 1-2 days of work. Ask the managers which they read best.

## What this round builds
N1, N2, P1 items 1-6, P2 items 8-12, P3 items 14-16 (as answered in the MCQs). Migration 15 (PhonePe type; `settlement_pending` table with the standard columns, RLS and audit). Tests for the not-settled sums; gallery for any new part; Preview → owner → production.

## Owner answers
- **D103** Not settled: a day box per payment type on Sales › By type, separate from the shift match, shown on Review (Q1).
- **D104** Today: a teal "Next" tag on the first card not done; done cards fold to one line (Q2).
- **D105** Shift sales: numbered parts (1 Cash · 2 Paytm, cards… · 3 Credit slips · 4 Customer payments) and a slim money bar always visible (Q3).
- **D106** Tanker: two steps, Challan then Chambers; price chips move to the totals; invoice date hidden as "today · Change" (Q4).
- PhonePe added as an optional payment type (N2).
