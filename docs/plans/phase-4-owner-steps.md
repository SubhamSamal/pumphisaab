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
