# Owner's manual: Phase 5a Part 2

**21 Oct 2026.** Steps 1-4 checked by you; **sent to the managers 21 Oct (update 01a15e9)**. Only step 5.2 is left: tell the managers.

## Step 1. Paste database update 17
1. Open https://github.com/SubhamSamal/pumphisaab/blob/main/supabase/migrations/20261021120000_nozzle_checks_and_attendants.sql
2. Click **Raw**. Press **Ctrl/Cmd + A**, then **Ctrl/Cmd + C**.
3. In Supabase, open the project **pumphisaab** › **SQL Editor** › **+ New query**. Paste, then click **Run**.
4. You should see **"Success. No rows returned"**. Any other red message: send it to Claude and don't run it again.
- [x] Done

## Step 2. Update PumpHisaab Preview
1. Open **PumpHisaab Preview**, close it fully, then open it again. Do this twice.
2. **Profile** should show **"update 01a15e5"**, with a **Check for update** button under it.
3. Tap **Check for update**. It should say **"You have the latest version."**
- [x] Done

## Step 3. Shift screen
Use today's real shift with real numbers. Preview uses the real database.
1. **Today** › **Shift A readings**.
2. **Who was on each nozzle:** tap each nozzle and pick the person. If only one person is ticked, tap **"Put [name] on all nozzles"**.
3. **Testing** › **The 5 L measure got:** type what the measure really had, e.g. 5.02.
   - **Green "measure OK":** the nozzle is within ±0.5%.
   - **Red:** the nozzle gives more than its meter (the pump loses).
   - **Amber:** it gives less (customers get less).
- [x] Done

## Step 4. Review and Dashboard
1. **Review and submit** › step 1 ends with **"Who sold what"**: each person's litres and about ₹.
2. **Dashboard** › **"Nozzle checks (5 L measure)"** is below the chart.
- [x] Done

## Step 5. Send to the managers
1. Tell Claude: **"Part 2 OK, send to production"**.
2. Tell the managers:
   - Close PumpHisaab and reopen it twice. This is the last time; after this, **Profile › Check for update** does it.
   - In each shift, pick who was on each nozzle.
   - When testing, pour into the 5 L measure and type what it got.
   - Then check: **Profile** shows **"update 01a15e9"**.
- [ ] Managers told
