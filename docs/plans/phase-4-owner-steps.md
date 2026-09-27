# Phase 4: your steps, slice by slice

One section per slice. Do the steps in order and send back what each step asks for.

---

## Slice 4a: day opens, price Confirm, opening dip (27 Sep 2026)

**What's new:** Today shows the price Confirm strip, the 8 section cards (only Opening dip opens for now; the rest say "Coming soon"), a date picker, and day locking. Opening dip shows litres the moment you type the dip, and flags (amber) if the dip jumped from last night.

### Step 1: paste migration 5 (about 3 minutes)
1. Open https://supabase.com/dashboard, open project **pumphisaab**.
2. Left menu › **SQL Editor** › **New query**.
3. In this repo open `supabase/migrations/20260927120000_day_opening.sql`. Read the box at the top (**DATA SAFETY**): it adds new tables, adds one empty column to your pump and fills it with today's date. Nothing is deleted.
4. Copy the whole file, paste it into the editor, click **Run**. You should see "Success. No rows returned".
5. New query, paste this, click **Run**:
   ```sql
   select (select string_agg(name, ', ' order by name) from schema_migrations_applied) as migrations,
          (select first_business_date from pumps where name = 'Shree Lokanath Filling Station') as first_day,
          (select count(*) from business_days) as days;
   ```
6. **Send me** a screenshot of the result. Expected: 5 migration names ending in `20260927120000_day_opening`, first_day = today's date, days = 0.

### Step 2: try it on the iPhone as owner (about 5 minutes)
1. On the Mac, in Terminal, in the project folder: `npm start`. Scan the QR code with the iPhone Camera (Expo Go opens).
2. Sign in as `subham` if asked. On **Today** you should see: today's date, the price box "Today's price · HSD ₹101.74 · MS ₹110.07 · Same as yesterday" and 8 cards.
3. Tap **Confirm**. The box turns into the two prices with a green "Confirmed".
4. Tap **Opening dip**. For the **Diesel tank HSD-1**: IOCL report stock `9702.74`, dip `59.8`. The litres line shows **5,074.74 L**.
5. For the **Petrol tank MS-1**: leave IOCL empty, dip `1714`. You should see a red message ending "Did you mean 171.4?". Change it to `55.2`: litres **4,536.78 L**.
6. Top right should say **Saved**. Tap **Done**. The Opening dip card has a green tick and says "Done · 2 tanks"; the bar says "1 of 8 done".
7. Tap the **‹** arrow above the price box: yesterday opens (as owner you can go back further, e.g. to 15 Sep).
8. **Send me** screenshots of Today (step 6) and the typo message (step 5).

### Step 3: try it on the Android phone as the manager (about 3 minutes)
1. Mac: stop the iPhone server (Ctrl+C), then `npm run start:android-app`. Open our app on the Android phone.
2. Sign in as `manager.test`. Today shows the price already **Confirmed** and Opening dip **Done**: the manager sees what you typed.
3. Open Opening dip and change the HSD dip to `60.3` (litres **5,134.02 L**), tap Done.
4. Tap **‹** three times: the manager can go back only 2 days (the arrow turns grey).
5. **Send me** one screenshot of the Opening dip screen.

### Good to know
- From tomorrow a red banner will say yesterday isn't submitted. That's correct: **Submit** arrives in slice 4f. Until then the Submit button stays grey and says what's left.
- Everything typed now is test data on the real pump (D45). The clean-up file before the pilot removes it.
- Lock and Unlock buttons show only on submitted days, so you'll see them after 4f.

---

## Slice 4b: shift meters and testing (27 Sep 2026)

**What's new:** Today's three shift cards open. Each shift has: who worked it (chips from Profile › Staff), one row per nozzle in use (HSD-3, HSD-4, MS-3, MS-4), the opening copied from the last shift and locked, the closing you type, and the litres sold. Tap a locked opening to report a meter change; the owner approves it. Testing is nozzle + litres. When every closing is typed, a card shows litres × price = Should have.

> Your phone picks up the new app code straight away, so **Today will say "The app is newer than the database" until you finish Step 1.** That's expected.

### Step 1: paste migration 6 (about 3 minutes)
1. Supabase › **SQL Editor** › **New query**.
2. Open `supabase/migrations/20260927130000_shift_meters.sql`, read the **DATA SAFETY** box (new tables only; it replaces the "open a day" function with one that also makes the shifts; nothing deleted).
3. Copy all, paste, **Run** → "Success. No rows returned".
4. New query, paste, **Run**:
   ```sql
   select (select count(*) from schema_migrations_applied) as migrations,
          (select string_agg(shift_code, ', ' order by starts_at) from shifts) as shifts_so_far;
   ```
5. **Send me** the result. Expected: migrations = 6. shifts_so_far is empty until someone opens Today; after Step 2 it shows "A, B, C".

### Step 2: Shift A on Android (as owner, about 5 minutes)
1. Open Today (tap **Try again** if it shows the old message). The three shift cards say "To do · 6 AM to 2 PM", "After Shift A · 2 PM to 10 PM", "After Shift B · 10 PM to 6 AM".
2. Tap **Shift A readings**. Tick one attendant.
3. This is the first shift in the app, so each opening says **Tap to type**. Tap **HSD-3**'s opening, type `126942.71`, **Save opening**. Do the same for HSD-4 `100000`, MS-3 `50000`, MS-4 `60000`.
4. Type closings: HSD-3 `127165.97` (sale **223.26**), HSD-4 `100500`, MS-3 `50100`, MS-4 `50050`: MS-4 shows a **red message** (closing below opening, H1). Change it to `60050`.
5. Turn on **Testing done this shift?**: it adds a 5 L test. Change litres to `10`.
6. The **Shift A meter sale** card shows HSD and MS litres × price and **Should have**. Tap **Done**. Today: Shift A has a green tick, "Done · … L sold".
7. **Send me** screenshots of the shift screen (step 6) and Today.

### Step 3: meter change on Shift B (Android as `manager.test`, then owner, about 4 minutes)
1. Sign in as `manager.test`. Open **Shift B readings**: openings are copied from Shift A's closings (locked).
2. Tap **HSD-4**'s opening › New opening `100510` › **Send to owner**. The row shows an amber note: waiting for the owner's approval. Today's Shift B card shows a red **1**.
3. Type all Shift B closings (any numbers above the openings) and tick an attendant.
4. Tap **‹** on Today three times: the manager can go back only 2 days.
5. Sign in as `subham`. Open Shift B, tap HSD-4's opening › **Approve new opening**. The red 1 on Today goes away.
6. **Send me** a screenshot of the Shift B screen before approving (step 2) and Today after (step 5).

### Good to know
- If an earlier shift has no closing yet, the next shift's closing box says "After Shift A". You can still tap the opening and type it from the meter; if Shift A's closing later differs, it becomes a meter change for the owner.
- Fixing a closing later (for example Shift A) updates the next shift's copied opening by itself.

---

## Slice 4c: tanker (27 Sep 2026) — plus the 4b re-check, all in one go

**What's new:** the **Tanker** tab: "No tanker today", today's tankers, earlier tankers, and **Add tanker**. A tanker has the tanker number, invoice number and date, and per fuel: litres ordered and short; **Received** (ordered − short) is worked out. Price and margin per litre are copied from the last tanker and shown as a line to check (**Change** if the invoice differs). Totals: Invoice amount, Short amount, To pay, Margin earned. Optional **dip check** (dip just before and after unloading): "Tank went up … L, challan says … L". A short of more than 0.3% or a dip check off by more than 0.5% shows an amber flag (no reason asked; Save still works). Today's Tanker card opens the tab and is done with a tanker or "No tanker today".

> As before, until Step 1 is done Today says "The app is newer than the database".

### Step 1: paste migration 7 (about 3 minutes)
1. Supabase › **SQL Editor** › **New query**.
2. Open `supabase/migrations/20260927140000_tanker.sql`, read the **DATA SAFETY** box (new tables only, nothing changed or deleted).
3. Copy all, paste, **Run** → "Success. No rows returned".
4. New query, paste, **Run**:
   ```sql
   select (select count(*) from schema_migrations_applied) as migrations,
          (select count(*) from tanker_receipts) as tankers;
   ```
5. **Send me** the result. Expected: migrations = 7, tankers = 0.

### Step 2: the 4b re-check (meter change approval, about 3 minutes)
1. Sign in as `manager.test`. Today › **Shift B readings** › tap the **grey HSD-4 opening** › New opening `100510` › **Send to owner**. The box turns amber; Today's Shift B card shows a red **1**.
2. Sign in as `subham`. Today shows an amber banner "1 meter change waiting for your approval" › **Open Shift B** › tap **Approve** on the HSD-4 row. The banner and the red 1 go away.
3. **Send me** a screenshot of the banner and of the row with **Approve**.

### Step 3: first tanker (as owner, about 5 minutes) — the real 15 Sep challan
1. **Tanker** tab (bottom bar) › **Add tanker**.
2. Tanker number `OD02CD9087`, invoice number `7018875672`, invoice date: tap **‹** once (the day before).
3. **Diesel**: Ordered `14000`, Short `28`. Received shows **13,972 L**.
4. First tanker ever, so price and margin are empty boxes: Price per litre `99.14`, Margin per litre `2.60`.
5. **Petrol**: leave empty (no petrol on this tanker).
6. Totals: Invoice amount **₹13,87,960**, Short amount **−₹2,776**, To pay **₹13,85,184**, Margin earned **₹36,327**.
7. Diesel › **Add dip check**: before `59.8`, after `119.8`. It shows "Tank went up 7,674.44 L, challan says 13,972 L" and an amber flag (these dips are made up, so they don't agree).
8. **Save tanker**. The tab lists **OD02CD9087 · HSD 13,972 L** with "1 flag". Today's Tanker card: green tick, "Done · OD02CD9087", amber **1**.
9. **Send me** screenshots of the totals (step 6), the dip check (step 7) and the Tanker tab (step 8).

### Step 4: second tanker and "No tanker today" (as manager, about 3 minutes)
1. Sign in as `manager.test`. **Tanker** › **Add tanker**, number `OD11AB4410`.
2. Diesel: price and margin now show as a line "Price ₹99.14/L · margin ₹2.60/L, from last tanker". Ordered `8000`, short `0`.
3. Petrol: Ordered `4000`, Short `20` → amber flag "Petrol tanker short 20 L out of 4,000 L". Tap **Change** for petrol price: `96.10`, margin `4.90`. **Save tanker**.
4. Open it again and tap **Remove this tanker** › **Remove tanker** (it was a test). It disappears.
5. Go back one day on **Today** (‹), then open the **Tanker** tab: turn on **No tanker today**. Today's Tanker card for that day says "Done · No tanker today".
6. **Send me** one screenshot of step 3 (the flag).

### Good to know
- A fuel with **Ordered** empty isn't on that tanker; a tanker with both fuels has both filled.
- "No tanker today" can't be turned on while a tanker is added for that day.
- A tanker counts in the day it was **unloaded** (the day open on Today), even if the invoice date is earlier.

---

## Fixes after your 4b/4c check (27 Sep 2026) — do these before the 4d steps

**What changed:**
- **Meter change (4b):** your own change as owner is saved **and approved** in one tap (no "Send to owner"). An approved opening turns **green** with "Meter change approved". A manager's change still waits for you (amber) with **Approve** on the row.
- **Tanker (4c):**
  - "No tanker today" switch removed. No tanker added = none came; the Tanker card on Today says "No tanker today" (the Review before Submit will ask once, in 4f).
  - **Invoice amount** from the challan is now a required box (next to the invoice number). The price per litre is **today's selling price − margin** (selling price comes from Today, margin from the last tanker); the totals show whether price × litres matches the challan.
  - **Chamber dips are mandatory:** "Tank dip before unloading", then one row per chamber: litres (from the challan) and our tank's dip after that chamber. Each row shows how much the tank went up and that chamber's short. The chambers must add up to Ordered. **Add chamber** / **Remove last**.
  - Petrol opens with **Add petrol** (so a diesel-only tanker stays short). Fewer helper lines everywhere.
  - Numbers in side-by-side boxes are smaller, and Android no longer cuts them off.
- **Sales:** fewer helper lines.

### Step 1: paste migration 9 (after 8)
1. Supabase › **SQL Editor** › **New query**, open `supabase/migrations/20260927160000_tanker_chambers.sql`, read **DATA SAFETY** (adds one empty column `invoice_amount` to tankers and a new chambers table; nothing deleted), paste, **Run**.
2. Check:
   ```sql
   select (select count(*) from schema_migrations_applied) as migrations,
          (select count(*) from receipt_chambers) as chambers;
   ```
   Expected: migrations = **9**, chambers = 0. **Send me** the result.

### Step 2: meter change as owner
1. As `subham`, open **Shift B**, tap **HSD-4**'s opening (green if you approved it earlier). Type a new opening, tap **Save new opening**: it turns green straight away, with no approval step.

### Step 3: the tanker again (the tanker you saved earlier has no chambers or invoice amount)
1. **Tanker** tab › open **OD02CD9087** › **Remove this tanker** (it was a test).
2. **Add tanker**: number `OD02CD9087`, invoice no. `7018875672`, invoice amount `1388011`.
3. Diesel: Ordered `14000`, Short `28`. Selling price shows **101.74** (from Today); Margin `2.60` → **Invoice price per litre ₹99.14/L**.
4. Tank dip before unloading `59.8`. Chambers: 1: `4000` litres, dip after `91.7`; **Add chamber** 2: `4000`, `122.2`; 3: `4000`, `154.5`; 4: `2000`, `172.8`. Each row shows the tank's rise (3,999.99 L, 3,985.55 L, 3,997.18 L, 1,985.27 L).
5. Totals: Invoice amount **₹13,88,011.00**, "Price × litres (+₹51.00 on the challan)" **₹13,87,960.00**, Short amount **−₹2,775.92**, To pay **₹13,85,235.08**, Margin earned **₹36,327**. **Save tanker**.
6. **Send me** screenshots of the chamber rows and the totals.

---

## Tanker fixes, round 2 (28 Sep 2026) — do these before the 4d steps

**What changed:**
- **Price as chips:** under Ordered/Short each fuel shows three small chips: **Selling ₹101.74** (from Today), **Margin ₹2.60** and **Invoice price ₹99.14/L**. No typing boxes. **Only you (owner) can tap the Margin chip** to set it; it's saved with your price, so every tanker after uses it. A manager sees "Ask the owner to set the margin" if it's missing.
- **Every chamber has Dip before and Dip after.** Adding a chamber fills its "before" with the last chamber's "after"; change it if diesel was sold in between. Under each row: "Tank went up … · short …". The separate "Tank dip before unloading" box is gone.
- **Totals:** the confusing "Price × litres" row is gone. If the challan differs from litres × invoice price, one plain line under the totals says by how much.

### Step 1: paste migration 10 (after 9)
1. Supabase › **SQL Editor** › **New query**, open `supabase/migrations/20260928120000_margin_and_chamber_dips.sql`, read **DATA SAFETY** (adds a margin column to prices and a "dip before" column to chambers, both empty; nothing deleted), paste, **Run**.
2. Check:
   ```sql
   select (select count(*) from schema_migrations_applied) as migrations,
          (select count(*) from fuel_prices where margin_per_l is not null) as margins_set;
   ```
   Expected: migrations = **10**, margins_set = 0. **Send me** the result.

### Step 2: set the margin and re-check the tanker (as owner)
1. **Tanker** › open **OD02CD9087**. The Margin chip may show the saved ₹2.60 or "not set": tap it › `2.60` › **Save margin** (diesel). Do the same for petrol once you know it.
2. Chambers now have Dip before and Dip after. Chamber 1: before `59.8`, after `91.7`. Chamber 2: before `91.7`, after `122.2`. Chamber 3 (say diesel was sold in between): before `121.0`, after `153.3`. Chamber 4: before `153.3`, after `171.7`. Each row shows "Tank went up … · short/over …".
3. Totals: Invoice amount ₹13,88,011.00, Short amount −₹2,775.92, To pay **₹13,85,235.08**, Margin earned ₹36,327, and one line: "The challan is ₹51.00 more than litres × invoice price (₹13,87,960.00)". **Save tanker**.
4. Sign in as `manager.test`, **Add tanker**: the Margin chip shows ₹2.60 and can't be tapped.
5. **Send me** screenshots of the chips + chambers, and the totals.

---

## Drafts on the tanker and credit slip (28 Sep 2026) — quick check before 4d

**What changed:** what you type on **Add tanker** and **Add credit slip** is kept on the phone as you type. Press Back (or the app closes) and open the same form again: everything is back, with a blue note **"Brought back what you typed"** and a **Start again** button. The note goes away once you **Save** (or Remove). Opening an existing tanker, changing something and going back keeps that change too, until you save it or tap Start again.

### Step 1: check it (as owner, 2 minutes)
1. **Tanker** › **Add tanker**: type a tanker number, invoice amount `100`, Ordered `4000`, chamber 1 litres `4000`. Press **Back** (don't save).
2. **Add tanker** again: everything you typed is there, with the blue note. Tap **Start again**: the form is empty.
3. Same with **Add credit slip** (Sales › a shift › Add credit slip): type a vehicle and slip number, Back, open again.
4. **Send me** a screenshot of the blue note.

---

## Slice 4d: Sales (27 Sep 2026) — test together with 4b and 4c

**What's new:** the **Sales** tab. **By shift**: one card per shift with Should have, every part of Received, and the Difference (Matched / Short / Excess). **By type**: each way of payment with the day total and the split by shift, and **None today** for an unused type. Tap a shift to enter its money:
- **Cash:** cash already in the drawer at the start (filled in from the previous shift's count; change it if cash was taken out), the note count (₹500 × n …), coins, and **Cash counted**.
- **Paytm, Card, XtraPower, Bank transfer:** one total each for the shift.
- **Credit slips:** Add credit slip: shift, company (search, or add a new one), vehicle, slip number, fuel, and the amount in **₹ or litres**; the other is worked out (litres rounded up, D27). A slip number used before is refused and names the company that has it (H7).
- **Payments from customers** (old dues / advances): company, amount, how paid. XtraPower / Paytm / Card / Cash dues are taken off that shift; bank transfers are only recorded (D47).
- **Done** fills every empty box with ₹0 and marks the shift's sales done. Today's **Sales** card is done when all three shifts are Done.

> Until Step 1 is done Today says "The app is newer than the database".

### Step 1: paste migration 8 (after 7)
1. Supabase › **SQL Editor** › **New query**, open `supabase/migrations/20260927150000_sales.sql`, read **DATA SAFETY** (new tables; managers may now add credit customers; the app may save opening cash and "sales done" on a shift; nothing deleted), copy all, paste, **Run**.
2. Check query:
   ```sql
   select (select count(*) from schema_migrations_applied) as migrations,
          (select count(*) from credit_sales) as slips;
   ```
3. **Send me** the result. Expected: migrations = 8, slips = 0.

### Step 2: Shift A money (as owner, about 8 minutes)
Shift A (27 Sep) already has readings: HSD 713.26 L after testing, MS 0 L.
1. Today: the price must be **Confirmed** (it is).
2. **Sales** tab › **By shift** › tap **Shift A**. Shift A's Should have is **₹72,567.07** (713.26 L × ₹101.74).
3. Cash in the drawer at the start: type `0`. Notes: ₹500 × `60`, ₹200 × `20`, coins `567.07`. Cash counted **₹34,567.07**.
4. Paytm `10000`, XtraPower `20000` (leave Card and Bank empty).
5. **Add credit slip**: shift A, company: type `SVT` › **Add "SVT" as a new company**, vehicle `OD29N6315`, slip `4461`, fuel HSD, **Rupees** `14000`. The line shows ₹14,000 ÷ ₹101.74 = **137.61 L**. **Save slip**.
6. **Add payment from customer**: company `Dord Logistics` (add it), amount `6000`, how paid **XtraPower** (the note says it's taken off Shift A). Save.
7. The money card at the bottom: Received = 34,567.07 + 10,000 + 20,000 + 14,000 − 6,000 = **₹72,567.07**, Difference **Matched**.
8. **Add credit slip** again with slip number ` 4461 ` (spaces around it), another company: it's refused: "Slip 4461 is already saved for SVT".
9. Tap **Done · Shift A sales**. **Sales › By shift**: Shift A shows the card with every line. **By type**: Card and Bank show "None today" buttons.
10. **Send me** screenshots of steps 5, 7 and 9 (By type).

### Step 3: manager, shift B (about 4 minutes)
1. Sign in as `manager.test`. **Sales › Shift B**: "Cash in the drawer at the start" says it's from Shift A's count (₹34,567.07).
2. Add a payment from customer by **Bank transfer** (`Maa Bhawani`, `300000`): the note says it's only recorded, not taken off.
3. Tap **Done · Shift B sales** (Shift B's readings are in; its Difference shows up).
4. **Send me** one screenshot of Shift B's money card.

### Fixes after your 4d check (28 Sep 2026)
- **Cut-off "0"** in Cash in the drawer, Card, XtraPower, Bank (it looked like "U"), and the first digit in the payment sheet: every typing box's text now fills the box, on every screen. A test stops this coming back (CLAUDE.md rule).
- **Company drop-down:** type in the Company box; a list under it shows the matching companies (names starting with what you typed first). Tap one: a tick shows in the box. If no company has exactly that name, the last row is **Add “…” as a new company**.

Check (as owner, 3 minutes): open **Sales › Shift A**: the 0s in Card and Bank show whole. **Add credit slip** › Company: type `S` (SVT shows), then `SVTX` (the last row says Add “SVTX”; don't add it). Pick **SVT**, change a letter: the tick goes and the list comes back. Press Back (the draft note shows next time; tap Start again). Send me a screenshot of the drop-down.

### Good to know
- A credit slip needs today's price **Confirmed** first (H6).
- Credit litres more than the meters sold in that shift show red (H9) and will block Submit.
- Fixing a number after Done is allowed; everything is logged.
