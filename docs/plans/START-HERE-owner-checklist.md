# Owner's manual: your steps

**Updated 20 Oct 2026. Start at section 1 and go down.** Tick a box when it's done. If anything looks different from what's written here, stop and send Claude a screenshot.

**Where we are today**
- The app has been live with you and both managers since 01 Oct, beside the notebooks.
- 01-05 Oct are checked and submitted. The managers carry on from 06 Oct.
- **Phase 5a Part 1 is built and on PumpHisaab Preview** (your phone only). The managers' app is unchanged until you say OK.
- Filling 06-19 Oct from the notebooks is **paused** until you send the missing photos (section 4).

---

## 1. Now: check Phase 5a Part 1 (about 20 minutes)

Part 1 brings three things:
- a **"Price is different"** button on Today (a manager's price waits for your OK);
- **Profile › Fuel prices**;
- **Dashboard › Fuel trend** (30 days of petrol and diesel Difference).

Do the steps in this order. Step 1 must come first.

### Step 1. Paste database update 16 in Supabase (5 minutes)
This adds the table where managers' price requests wait for you. It **only adds**: no data is deleted or changed.

1. On the laptop, open this link: https://github.com/SubhamSamal/pumphisaab/blob/main/supabase/migrations/20261020120000_price_requests.sql
2. Click the **Raw** button (top right of the file). A plain page of text opens.
3. Press **Ctrl + A** (Mac: **Cmd + A**) to select everything, then **Ctrl + C** (Mac: **Cmd + C**) to copy.
4. In another tab, open https://supabase.com/dashboard and sign in. Click the project **pumphisaab**.
5. In the left menu, click **SQL Editor**, then **+ New query**.
6. Click inside the empty box and press **Ctrl + V** (Mac: **Cmd + V**) to paste.
7. Click **Run** (bottom right), or press **Ctrl + Enter**.
8. **What you should see:** "Success. No rows returned" at the bottom.
   - If it says **"was already applied. Nothing was changed."**, it's already in. That's fine; go on.
   - Any other red message: don't run it again. Copy the message and send it to Claude.
- [ ] Database update 16 pasted.

### Step 2. Get the new version on PumpHisaab Preview (2 minutes)
1. On your Android phone, open **PumpHisaab Preview** (the one with "Preview" in its name, **not** the managers' PumpHisaab).
2. Close it fully: open the recent-apps screen and swipe it away.
3. Open it again, wait 10 seconds, and close it fully again. The first open downloads the update; the second one shows it.
4. Open it a third time and go to **Profile**. At the bottom it should say **"update 01a1595 (over the air)"**.
   - If it still shows an older update, check the phone has internet, then close and reopen once more.
- [ ] Preview shows update 01a1595.

### Step 3. Profile › Fuel prices (3 minutes)
1. In Preview, tap **Profile** (bottom bar), then **Fuel prices**.
2. **What you should see:**
   - **Diesel (HSD)** first, then **Petrol (MS)**.
   - Each price has its start date and margin. The price in force today says **Now** in green.
   - Prices for later dates (if any) say **Starts later**.
3. Tap **Add new price** at the bottom. A box opens with Diesel/Petrol, price per litre, dealer margin (filled with today's margin) and "Starts on" (today; the arrows move it to later days, never earlier).
4. **Close the box without saving** (tap outside it or swipe it down). Only add a price when IOCL really changes it (section 3).
- [ ] Fuel prices screen looks right.

### Step 4. Today: the "Price is different" button (3 minutes)
1. Tap **Today**. Look at the price strip near the top.
2. **What you should see:** today's diesel and petrol prices, **Confirmed** (or a **Confirm** button), and a **Price is different** button.
3. Tap **Price is different**. A box opens with today's prices already filled in.
4. **Close it without sending.**
   - Preview uses the real database.
   - As owner, a price you send is used at once for today, for everyone.
- [ ] I saw the button and the box, and closed it without sending.

### Step 5. Dashboard › Fuel trend (5 minutes)
1. Tap **Dashboard** (bottom bar).
2. **What you should see:**
   - At the top: **This month (Oct 2026)**, with each fuel's total Difference in litres and % ("Short" in red, "Excess" in amber), about ₹, and how many days were submitted.
   - Below it, one row per day, newest first, showing each fuel's Difference that day.
     - **OK** in green means within your limit.
     - Days not yet submitted say **not submitted** and are not counted in the month total.
     - "Dips not in yet" means the closing dip isn't typed yet.
3. Check two days against the notebook's "Diff." column in the stock register. 01 Oct petrol should be about **−26.58 L** (the real short). The app's figures are a little more exact than the book (it keeps the decimals).
4. Tap a day. Its **Review** opens. Go back with the arrow.
- [ ] Fuel trend looks right against the notebook.

### Step 6. Time per shift (3 minutes, only reads)
This tells Claude how long each shift takes to fill and which part is slowest, so we can make it faster (goal: 10-15 minutes or less per shift).
1. Open https://github.com/SubhamSamal/pumphisaab/blob/main/supabase/fixes/2026-10-20-read-time-per-shift.sql, click **Raw**, then select all and copy.
2. In Supabase, open **SQL Editor › + New query**, paste, and click **Run**.
3. One cell comes back (a long text). Click on it, copy everything (Ctrl/Cmd + A, then Ctrl/Cmd + C), and paste it in the chat with Claude.
- [ ] Time-per-shift result sent to Claude.

### Step 7. Send it to the managers
1. If steps 3-5 looked right, write to Claude: **"Part 1 OK, send to production"**.
2. Claude sends the update. Then tell each manager:
   - "Close PumpHisaab fully and open it again, twice."
   - Then: Profile › bottom line shows a new "update …" number (Claude will tell you which).
3. Tell them about the new button (section 3, the manager part).
- [ ] Part 1 is on the managers' phones.

---

## 2. Every day

**Managers**
1. They fill the day in **PumpHisaab** as now. The notebooks continue for now.
2. In the morning they **Confirm** today's price on Today.

**You, in the evening**
1. Open **Review and submit** for the day and compare it with the notebook.
2. Submit days **in order** (the app won't let a later day go first).
3. Look at **Dashboard › Fuel trend** for the petrol and diesel Difference. Watch the petrol short day by day.
4. Anything different or confusing: send Claude a screenshot. It goes into the next phase's plan unless it stops the managers working.

---

## 3. When IOCL changes the price (new from Part 1)

**If a manager sees the new price first**
1. On Today, the manager taps **Price is different**, types the new price per litre for that fuel, and taps **Send to the owner**.
2. They keep filling the day. The money check and Submit wait for you.

**You**
1. On your Today you see **"New price waiting for your OK"**, with the price, who typed it, and today's old price.
   - It also shows in **Profile › Fuel prices**.
   - From Phase 5b it will come as a phone alert too.
2. Check the price against the IOCL message.
   - Right: tap **Approve**. The new price is used for that day and after.
   - Wrong: tap **Keep old price**.
3. The manager then taps **Confirm** on the price strip, and the day goes on as normal.

**If you know first**
- Either: **Profile › Fuel prices › Add new price**. Pick the fuel, type the price and margin, choose the start date (today or a later day), then tap **Add price**.
- Or: on Today, tap **Price is different**, type it, then tap **Use this price** (for today).
- The managers then tap **Confirm** once more.

Old days never change: each day keeps the price in force on its date.

---

## 4. Waiting on you (no rush)

### 4a. Days 06-19 Oct from the notebooks — paused
Plan: `docs/plans/fill-6-to-19-oct.md`. When you're ready:
- [ ] Send photos of the missing pages. One photo per page, flat, in daylight, the whole page in the picture.
  - **Shift book:** 06-12 Oct (all shifts), 13 Oct A, 14 Oct (all), 15 Oct (all), 16 Oct C, 17 Oct (all), 18 Oct (all), 19 Oct A.
  - **Summary book:** 15, 16, 17, 18 and 19 Oct.
  - **Tanker (unloading) register:** the tankers of 07 Oct, 09-10 Oct, 12 Oct, 15-16 Oct, and 19 Oct.
  - **Stock (dip) register:** 18 and 19 Oct.
- [ ] Answer Claude's 7 questions, e.g. "1A 2A 3A 4A (nozzles …) 5A 6A 7A".
- [ ] Check Lingaraj's slips 5650-5664 for 16 Oct (one OD04L5551 ₹2,000 slip is in both Shift A and B), and Shift B's last balance figure (about ₹10,210.84).

After you say "go", Claude gives you a read-only query to paste (same way as section 1, step 6), then the fill file. Then you check Review for 06 Oct onwards and submit in order, 3-4 days at a sitting.

### 4b. Other things Claude asked
- [ ] The formula for **"Sold as per sales amount"**, with one worked day from the notebook (built in Phase 5b).
- [ ] The shift boys' phones: 2-3 models and their Android version (Settings › About phone), for the low-end phone work later.
- [ ] Ask the managers and boys which they read best: English, Odia or Hindi.
- [ ] Confirm what the app saves while offline (decision D78), when you have a minute.
- [ ] Around **09 Nov**: run the monthly backup restore test (Claude will remind you and give the steps).

---

## 5. What comes next
- **Phase 5a Part 1, last piece (Claude, no steps for you):** 02-05 Oct become test cases, so a future change can never quietly change those days' numbers.
- **Part 2:**
  - "The 5 L measure got" box in Testing (shows which nozzle is off).
  - **"Who"** on each nozzle per shift.
  - Database update 17 to paste.
- **Part 3:**
  - Easier screens: a "Next" tag on Today, Sales in numbered parts with the money bar always visible, the tanker in two steps.
  - "Not settled yet" boxes.
  - Database update 18 to paste.
- **Phase 5b:**
  - Flags, the bell, unlock request, owner notes, other sales (lubes, gas), "Sold as per sales amount".
  - **Phone alerts (push).** These need the managers to **install the app once more** from a new link (Claude will give the steps).
- **Later:**
  - Settings screens and the full Dashboard (Phase 6).
  - Cheap-phone testing and the website at **www.pumphisaab.com** with the web app at app.pumphisaab.com (Phase 7).
  - Shift boys entering their own shift in 10-15 minutes or less (Phase 7a).
  - Notebooks retired (Phase 8).
  - Other pumps (v2).

---

## 6. Done so far
- **25-27 Sep:** setup, app shell, calculation engine, foundations.
- **29 Sep - 03 Oct:** daily entry built; production app on your and both managers' phones.
- **01 Oct:** first real day in the app (parallel run with the notebooks started).
- **09 Oct:**
  - Pilot fixes round 1 in the managers' app.
  - Nightly backup on; first restore test passed.
- **10 Oct:**
  - PhonePe and "Cash deposited in bank" boxes (database update 15).
  - 02-05 Oct filled from the notebooks.
- **13 Oct:**
  - "Cash deposited in bank" removed from customer payments (update 01a1347).
  - 01-05 Oct checked and submitted.
- **20 Oct:**
  - Phase 5a planned (your answers D112-D121).
  - Roadmap extended: shift boys, low-end phones, website.
  - Part 1 built and on Preview.

---

## 7. How-to (for any step)
- **Pasting a database file:**
  1. Open the file's GitHub link, click **Raw**, select all and copy.
  2. In Supabase, open **SQL Editor › + New query**, paste, and click **Run**.
  3. Paste database updates (migrations) **before** Claude sends the matching app update, and only once. Each file refuses to run twice.
- **Getting an app update:** close the app fully and open it again, twice. **Profile** › bottom line shows the update number. No reinstall unless Claude says so.
- **Preview first, always:** every change reaches **PumpHisaab Preview** first. You check it, then Claude sends it to the managers' **PumpHisaab**.
- **Preview uses the real database.** Look and try, but don't send real prices, slips or submits from Preview unless you mean them.
- **Something wrong:** take a screenshot (or copy the red message) and send it to Claude. Don't retry a database file that showed an error.
