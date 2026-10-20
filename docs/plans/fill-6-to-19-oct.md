# Filling 06-19 Oct from the notebooks (plan, 20 Oct 2026)

Status: **plan; waiting for the owner's answers, the missing pages and "go".** Same method as 2-5 Oct (`supabase/fixes/2026-10-10-fill-2-to-5-oct.sql`, learnings §4c): one one-off file in `supabase/fixes/`, tested on a local copy of the live data, which refuses to run twice or on top of anything already typed. Days stay DRAFT; the owner checks Review and submits them in order.

## 1. What the owner sent (20 Oct)
6 PDFs (42 pages) + 6 photos. Read page by page; duplicates ignored (`10-17 06.17` p7 = p8; 2-page spreads that repeat the next page).

| Day | Summary book (day totals, all slips, payments, POS, expenses, cash in hand) | Shift book (per shift) | Stock register (dips) | Tanker |
|---|---|---|---|---|
| 06 Oct | ✅ 3 pages | ❌ | ✅ | 05 Oct tanker's last 4,000 L (already in the app as chamber 5) |
| 07 Oct | ✅ 4 pages | ❌ | ✅ | IOCL 20,000 L inv. 7011713893 ✅ · plus 800 L bought from Samal Fuel (see Q3) |
| 08 Oct | ✅ 3 pages | ❌ | ✅ | none |
| 09 Oct | ✅ 3 pages | ❌ | ✅ | IOCL 20,000 L inv. 7011775259: 15,000 L on 09 Oct |
| 10 Oct | ✅ 3 pages | ❌ | ✅ | … and the last 5,000 L on 10 Oct |
| 11 Oct | ✅ 4 pages | ❌ | ✅ | none |
| 12 Oct | ✅ 4 pages | ❌ | ✅ | IOCL 14,000 L inv. 7011856011 |
| 13 Oct | ✅ 3 pages | B ✅ C ✅ · A ❌ | ✅ | none |
| 14 Oct | ✅ 3 pages | ❌ | ✅ | none |
| 15 Oct | ❌ | ❌ | ✅ | 15,000 L (stock register only; no invoice seen) |
| 16 Oct | ❌ | A ✅ B ✅ · C ❌ | ✅ | … and 5,000 L on 16 Oct |
| 17 Oct | ❌ | ❌ | ✅ | none |
| 18 Oct | ❌ (staff credit list only) | ❌ | ❌ | ? |
| 19 Oct | ❌ | B ✅ C ✅ · A ❌ | ❌ | probably (diesel back up to 16,197 L by Shift B) |

Also: the Lingaraj Behera ledger page (slips and payments 06-17 Oct, a good cross-check), the stock report sheet (01-18 Oct) and stock register pages for 25 Sep-05 Oct (not needed).

## 2. What's missing
1. **Shift book pages for most shifts:** all of 06-12 Oct, 13 A, all of 14 and 15 Oct, 16 C, all of 17 and 18 Oct, 19 A. The app keeps everything per shift (meter closings, who worked, cash, Paytm/cards/XtraPower, slips, expenses), and last time the shift book was the per-shift truth.
2. **Summary book for 15-19 Oct** (slip numbers, vehicles, litres, payments received, expenses).
3. **The tanker notebook (unloading register)** for every tanker: tanker no., chamber litres and the dip after each chamber. The app's tanker screen needs these (the summary only gives invoice no., total litres and amount).
4. **Stock register 18 and 19 Oct** (opening/closing dips).

## 3. What I checked
- **Slips match the summary book to the rupee on every day 06-14 Oct** (count, litres and ₹). Litres are within 0.04 L except 13 Oct (2 L: slip 5588 reads 137.47 L but ₹14,190 is 139.47 L) and 14 Oct (slip 5622: ₹3,100 is 30.47 L, written 30.70).
- **Meter readings run on day to day** for all 8 nozzles (each day's opening = the day before's closing).
- **Dips agree** between the summary book and the stock register for 06-17 Oct.
- **Shift books against the day:** 13 Oct B + C agree with the summary's meter totals.

## 4. Things in the notebooks that need a decision (MCQs in §6)
- **07 Oct: 800 L diesel bought from Samal Fuel** (bill 422291, ₹81,392) and given to MGM (slip 675, 800 L, ₹81,392) without passing our tank or meters (the stock register counts sale 8,110 L, not 8,910 L). On 08 Oct: D.D. Samal brought ₹65,000 and Samal Fuel was paid ₹65,000 + ₹16,392 in cash.
- **07 Oct testing: 223.50 L petrol and 125.30 L diesel** (normally 10-27 L a day). Petrol nozzles 1 and 2 also start selling on 07 Oct (the app had them off, D30).
- **11 Oct lubes ₹300 (SAT 900 ml) and gas stove/cylinder ₹3,120; 16 Oct B "Raghunath Gas 4T 900 ml ₹300".** The app has no place for non-fuel sales.
- **Salaries (10 Oct ₹74,092) with advances taken back as "payment received … salary adj"** (Bhagirathi ₹3,500, Gobardhan ₹60, Tuna ₹3,565, Jitendra ₹2,000, Rudra ₹2,500, Lingaraj ₹1,000; Maheswar ₹900 on 09 Oct).
- **Slip number 5326 written twice on 07 Oct** (OD35J0572 and OD35K0866); the second is probably 5325.
- **Notebook sums that don't add up:** (16 Oct A is fine: card was ₹25,000, owner 20 Oct) 16 Oct B ₹40 apart; 19 Oct B ₹5 apart; 11 Oct expenses written ₹16,659 but the lines add to ₹17,059.

## 5. How notebook items go into the app (same rules as 2-5 Oct, no question needed)
- Dips: the cm from the book; the app works out litres from the chart (the book drops decimals).
- Cash counted = the shift book's "Bal" to the rupee; cash at start = the previous shift's Bal. A notebook sum mistake then shows as a Difference on Review, which is right.
- Paytm = settled + not settled for the shift; XtraPower/cards = the shift's machine total.
- Customer payments by HDFC transfer: no shift (in and out of the same shift in the book). By Paytm/XtraPower/card/PhonePe: in that shift.
- **"Pending" slips** (16 Oct A: MGM, Darcl, Tata Steel, Lingaraj): credit slips with the slip number left blank as 0000 (how you filled 1 Oct).
- **S.V.T. "cash" lines** (₹1,800 on 11 Oct, ₹21,900 on 19 B, ₹32,800 on 19 C): expense type "Cash advance to credit customer" (D33).
- **HDFC deposits** (₹65,000 on 14 Oct, ₹35,000 on 16 B): "Cash deposited in bank" (D111).
- **Meter jump** (₹27 on 10 Oct, ₹38 + ₹17.61 on 13 Oct): expense "Meter jump".
- New names (companies, expense types) are added the way the 2-5 Oct file did.
- Nothing a manager already typed is touched: step 1 is a read-only check of what the app holds for 05-20 Oct.

## 6. Questions for the owner (recommended first)
**Q1. The missing shift pages.**
- **A (recommended): you send photos of the missing shift book pages, summary pages for 15-19 Oct and the tanker register.** Each day goes in exactly per shift, like 2-5 Oct.
- B: fill 06-14 Oct now from the summary book, with the whole day in Shift A (B and C empty). Day totals right, but shift checks, who worked and cash per shift would be wrong.
- C: fill only the days with complete pages and leave the rest for the managers to type by hand.

**Q2. A day the managers already started in the app** (the read-only check will tell us).
- **A (recommended): leave that day to the managers / you; the file skips it.**
- B: add only the parts that are empty (risky: half-and-half days are hard to check).

**Q3. The 800 L from Samal Fuel (07-08 Oct).**
- **A (recommended): keep it out of the app** (not our tank or meters): no MGM slip 675, no ₹65,000 in and out; on 08 Oct only the ₹16,392 cash paid to Samal Fuel as an expense, so the drawer matches. MGM's ₹81,392 is noted in the learnings.
- B: enter slip 675 anyway (Review would show ₹81,392 too much received, since the meters never sold it).

**Q4. The big test on 07 Oct (223.50 L petrol, 125.30 L diesel).**
- **A (recommended): enter as testing (fuel put back in the tank after nozzle work).** Tell me which nozzles.
- B: it's a mistake in the book; tell me the right figures.

**Q5. Lubes and gas (₹300 + ₹3,120 on 11 Oct, ₹300 on 16 Oct B).**
- **A (recommended): leave them out and lower the cash counted by the same amount**, so the fuel money matches. "Other sales" goes into the Phase 5 backlog.
- B: wait until the app can take other sales.

**Q6. Salaries and "salary adj".**
- **A (recommended): one expense "Salary" per person, for the cash actually paid** (salary minus the advance taken back). Received money stays fuel-only.
- B: full salary as an expense + each advance taken back as a "payment from customer" with the staff member as a company.

**Q7. Slip 5326 twice on 07 Oct.**
- **A (recommended): the second (OD35K0866) is 5325.**
- B: keep both as 5326.

## 7. Steps after "go"
1. **Owner:** paste `supabase/fixes/2026-10-20-read-days-6-to-19-oct.sql` (read only) and send back the one cell.
2. **Claude:** match names; transcribe the remaining pages; check every shift's sums in Python; write `supabase/fixes/2026-10-2x-fill-6-to-19-oct.sql` (DATA SAFETY header; refuses a day that has anything already; one step, all or nothing); test it on a local copy rebuilt from the read-only result; run the database tests; commit and push.
3. **Owner:** paste the fill file in the Supabase SQL editor and send back the last table (each day's result).
4. **Owner:** open Review for each day from 06 Oct, compare with the notebook, submit in order. The days are probably too many for one sitting: do 3-4 a day.
5. **Claude:** learnings from the fill (notebook habits, mistakes found); decisions logged.

No app update and no migration: this is data only.
