# Phase 4: your steps, slice by slice

> **Owner: don't start here.** Your current checklist is `docs/plans/START-HERE-owner-checklist.md`. This file keeps the details of each slice.

One section per slice. Do the steps in order and send back what each step asks for.

---


> Steps for 4a-4d (all done) are in `docs/plans/archive/phase-4-owner-steps-4a-4d.md`.

## Slices 4e + 4f: Expenses, Closing dip, Review, Submit, offline (built overnight 28→29 Sep 2026)

**What's new:**
- **Expenses** (a Today card): list with where each rupee came from ("From Shift B cash", "Paid by owner"), totals, **No expenses today**. **Add expense**: type chips, amount, "Where did the money come from?" (starts on the shift running now). "Other" asks what it was; "Cash advance to credit customer" can name the company. Cash paid from a shift's drawer is added back to that shift's money, so the shift doesn't look short.
- **Closing dip** (a Today card): dip → litres, and **Sold today as per tank** with the sum written out ("Opening 5,074.74 + tanker 13,972 − closing 12,749.18"). A missed decimal point gets "Did you mean 171.4?".
- **Review and submit:** Today's bar turns teal when all 8 cards are done. Review has 3 steps: **Fuel** (tank vs meters, Difference, "About ₹… · limit is … L"), **Money** (each shift + day total), **Flags** (what you'll see, and the exact message you'll get). If no tanker was added, it asks "Did no tanker come today?". **Submit day** → "Submitted" with the result and **Start <next day>**.
- The database re-checks everything on Submit and says in one sentence what's missing ("Finish these first: Closing dip.", "Submit 27 Sep first.").
- **Offline:** with no internet, dips, meter readings, notes, coins and payment totals wait on the phone; the header says **"Offline · 3 waiting"** and they're sent by themselves when the internet is back. The tanker, slip and expense forms keep what you typed and ask you to tap Save again.

> After 6 AM on 29 Sep, Today is 29 Sep and shows red banners for 27 and 28 Sep (not submitted). That's expected. Use the date arrows to go back.

### Step 1: paste migrations 11 and 12 (both only add things)
1. Supabase › **SQL Editor** › **New query**: open `supabase/migrations/20260929120000_expenses.sql`, read **DATA SAFETY**, paste, **Run**.
2. **New query**: open `supabase/migrations/20260929130000_closing_and_submit.sql`, read **DATA SAFETY** (adds two empty columns to days, new views and functions), paste, **Run**.
3. Check:
   ```sql
   select (select count(*) from schema_migrations_applied) as migrations,
          (select count(*) from expenses) as expenses,
          (select count(*) from v_day_match) > 0 as fuel_check_works;
   ```
   Expected: migrations = **12**, expenses = 0, fuel_check_works = true. **Send me** the result.

### Step 2: last night's fixes (5 minutes)
1. **Sales › Shift A**: the 0s in Card and Bank show whole (no "U").
2. **Add credit slip › Company**: type `S` (SVT shows in the list), then `SVTX` (last row: Add "SVTX"; don't tap it). Pick SVT, change a letter: the tick goes and the list comes back.
3. **Tanker › Add tanker**: type a number and `4000` litres, press Back, open Add tanker again: the blue "Brought back what you typed" note. Tap **Start again**.

### Step 3: finish 27 Sep (as owner, 10 minutes)
1. Today › arrows back to **Sun, 27 Sep 2026**.
   - First, free slip number 4461 for the notebook numbers (Step 4): **Sales › Shift A** › tap the SVT slip **4461** › change the slip number to `9461` › **Save slip**. (Otherwise the notebook's slip 4461 is refused: H7, a slip number can't be used twice.)
2. **Expenses** › **Add expense**: Tiffin, `450`, **Shift B cash drawer** › Save. Then Salary, `18000`, **Owner paid** › Save. Check the totals: From shift cash ₹450, Paid by owner or bank ₹18,000. **Sales › Shift B**: "Cash paid out (expenses) ₹450" is in Received.
3. Finish whatever Today still shows as not done (Shift C readings + who worked, Shift C sales Done…).
4. **Closing dip**: Diesel and Petrol (any sensible dips). Each shows "Sold today as per tank" and the sum. Try `1714` once: "Did you mean 171.4?". **Done · Next: Review**.
5. **Review**: Fuel › Next › Money › Next › Flags. Answer **Yes, none came** if asked about a tanker. Read the message you'd get. **Submit day**.
6. **Send me** screenshots of each Review step and the Submitted screen.

### Fixes after your 4e/4f check (29 Sep 2026) — before Step 4
- **Company and "What for" boxes:** only the **2 most used** show; type to find the rest; "Add … as a new company/type" when nothing matches. Managers can add expense types too.
- **"Start again"** is now an outlined button lined up with the text.
- **Today:** no Submit bar at the bottom. The last card is **Review and submit**: it says what's left ("Finish 1 more section first"), "Ready…", or "Submitted · Matched".
- **Review step 3 is "Summary":** **red** = fix before you can submit (e.g. "Sales: tap Done on Shift C"), **yellow** = minor, you can submit, the owner sees it (e.g. "MS-3 sold nothing today"), **green** = checks passed. Long differences wrap instead of running off the card.
- What's allowed: money **±₹100 per shift**, fuel **±0.5%**. Beyond that is yellow only; it never stops Submit. On 27 Sep it was Shift C's sales not being marked Done that stopped you, not Shift B's ₹22.

Paste **migration 13** first (`supabase/migrations/20260929140000_expense_types_by_managers.sql`: one permission, nothing deleted). Check: `select count(*) from schema_migrations_applied;` → **13**.

Then on 27 Sep: **Sales › Shift C › Done**, open **Review and submit** (last card), Summary: red list empty → **Submit day**. Send me the Summary screenshot.

### Step 4: the real test, the 15 Sep notebook numbers typed into 28 Sep (as owner, with a stopwatch)
Why 28 Sep: it comes right after 27 Sep (submitted in Step 3), so "yesterday first" is happy and it stays open for fixes. (Typing it into 15 Sep itself would put a day before 27 Sep and make 27 Sep's openings look wrong.) The 15 Sep totals are known, so we can compare. Open **Mon, 28 Sep 2026** with the date arrows. Start the stopwatch.
1. **Confirm** the price (MS ₹110.07, HSD ₹101.74).
2. **Opening dip**: Petrol IOCL `7071`, dip `55.2`; Diesel IOCL `9602`, dip `59.8`. (Amber notes about last night's dip are expected: 27 Sep's test dips were different.)
3. **Tanker** (Invoice 7018875672): as you did on 27 Sep: invoice amount `1388011`, Diesel ordered `14000`, short `28`, the 4 chambers.
4. **Shift A**: the openings are copied from 27 Sep's closings, so change each one (tap the grey opening › type › **Save new opening**; as owner it's approved at once): MS-3 `126942.71`, MS-4 `29804.03`, HSD-3 `567503.44`, HSD-4 `947934.58`. Closings MS-3 `127165.97`, MS-4 `29815.57`, HSD-3 `570104.08`, HSD-4 `951594.39`; tick who worked; testing MS-3 `10`, HSD-3 `10`.
5. **Shift B and C**: the openings copy by themselves; type the same numbers as closings (the notebook keeps the whole day in one shift); tick who worked.
6. **Sales › Shift A**: cash in the drawer at the start `36013.04`; coins `22919.99` (the cash in hand); Paytm `55408.10`, Card `2560`, XtraPower `1003216.67`, Bank `0`; the 29 credit slips from the notebook; payments from customers: Dord Logistics `365052` XtraPower, United Infracorp Ltd `600000` XtraPower, Bijay Ku Sahoo `300000` Bank transfer, Maa Bhawani Roadlines `300000` Bank transfer. **Done**.
7. **Sales › Shift B and C**: cash in the drawer at the start `0`, **Done** (nothing was sold in them).
8. **Expenses** (all from Shift A cash): Tiffin `160`, DG rent `15000`, Staff advance `100`, Staff food `300`, Tanker unloading `350`, Tanker driver food `200`, Cash advance to credit customer `11000`.
9. **Closing dip**: Petrol `53.2`, Diesel `119.8`.
10. **Review**, stop the stopwatch before **Submit**. The app should say:
    - Petrol: tank **229.54 L**, meters **224.80 L**, Difference **Short −4.74 L (−2.07%)**
    - Diesel: tank **6,297.56 L**, meters **6,250.45 L**, Difference **Short −47.11 L (−0.75%)** (the notebook circled −75 because it added the full 14,000 L, not 14,000 − 28)
    - Shift A: Should have **₹6,60,664.52**, Received **₹6,60,664.52**, **Matched** (credit slips ₹5,50,514.80, expenses from the drawer ₹27,110, customer payments taken off ₹9,65,052)
11. **Submit day**.
12. **Send me**: the stopwatch time, and screenshots of Review steps 1 and 2.

### Step 5: airplane mode (3 minutes)
1. Open today's day › **Opening dip**. Turn on **airplane mode**. Type a dip in both tanks and leave the boxes: the header says **"Offline · 2 waiting"**.
2. Go back to Today and open Opening dip again: your numbers are still there.
3. Turn airplane mode off. Within 20 seconds the header says **Saved**.
4. **Send me** a screenshot of "Offline · 2 waiting".

### What's next (4g, together)
The preview APK (installed like a normal app, no Mac needed), Sentry crash reports, and the first over-the-air update test. These need your Expo and Sentry accounts, so we do them together after this check.

---

## 4g: the preview app, crash reports, over-the-air update (29 Sep 2026)

**What's new:** a real app, **PumpHisaab Preview**, that works without the Mac (any Wi-Fi or mobile data). It installs **beside** your development app (different name and icon label), has the new drop icon, sends crash reports to Sentry (no names, emails or typed numbers), and gets fixes over the air. Profile shows which code it runs: "App 1.0.0 · preview · built-in code" (after an update: "update 3f2a91c").

> Your development app needs one restart of the Mac server after this change (the Sentry setup changed how the code is packed): stop `npm run start:android-app` (Ctrl+C) and start it again.

### Step 1: install the preview app (5 minutes)
1. On the Android phone, open the install link I send (expo.dev › build page) in Chrome › **Install** (or download the .apk and open it).
2. Android asks to allow installs from Chrome/Files once: **Settings › Allow from this source** › back › **Install**. If Play Protect warns ("unknown app"), tap **More details › Install anyway** (the app is ours, built by Expo).
3. Open **PumpHisaab Preview** › sign in as `subham` › Today loads (turn Wi-Fi off once to see it works on mobile data).
4. **Send me** a screenshot of Today and of Profile (with the version line at the bottom).

### Step 2: test crash report (1 minute)
1. Profile › tap the grey version line **5 times** › **Send a test crash report** › "Sent…".
2. Tell me; I check it arrived in Sentry (you can see it too: sentry.io › Issues).

### Step 3: over-the-air update (3 minutes, when I say it's sent)
1. Close PumpHisaab Preview fully (swipe it away from recent apps) and open it. It downloads the update quietly.
2. Close it fully again and open it: Profile's version line now ends with **"update …"** and says **OTA test**.
3. **Send me** that screenshot.
