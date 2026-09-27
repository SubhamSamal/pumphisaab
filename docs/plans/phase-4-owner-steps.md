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
