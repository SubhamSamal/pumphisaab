# Your checklist: Phase 4 final steps and go-live

**Start at the top. Tick each box as you go.** When a step says "Send me", send it and wait for my reply before the next part.
Use the **PumpHisaab Preview** app for everything here (not the old development app).

---

## Part A · Finish the test days (about 1 hour 15 minutes)

### A1. Paste migration 13 (2 minutes)
- [ ] Supabase › **SQL Editor** › **New query**.
- [ ] Open `supabase/migrations/20260929140000_expense_types_by_managers.sql`, copy everything, paste, **Run**. (It adds one permission; nothing is deleted.)
  - If it says "was already applied", that's fine: you did it before.
- [ ] Run this check: `select count(*) from schema_migrations_applied;`
- [ ] It must show **13**.

### A2. Submit 27 Sep (5 minutes)
- [ ] Today › use the **‹** arrow to go to **Sun, 27 Sep 2026**.
- [ ] **Sales** › **Shift A** › tap the SVT slip **4461** › change the slip number to `9461` › **Save slip**. (This frees number 4461 for the notebook day in A3.)
- [ ] **Sales** › **Shift C** › **Done**.
- [ ] Today › tap the last card, **Review and submit** › **Next** › **Next** › on **Summary** the red list should be empty.
- [ ] **Submit day**.
- [ ] **Send me** a screenshot of the Summary.

### A3. The real test: 15 Sep notebook numbers typed into 28 Sep (about 1 hour, start a stopwatch)
Keep the 15 Sep notebook open next to you.
- [ ] Today › go to **Mon, 28 Sep 2026** › **start the stopwatch**.
- [ ] **Confirm** the price (HSD ₹101.74, MS ₹110.07).
- [ ] **Opening dip**: Petrol IOCL `7071`, dip `55.2` · Diesel IOCL `9602`, dip `59.8`. (Amber notes are expected.)
- [ ] **Tanker › Add tanker**: number `OD02CD9087`, invoice no. `7018875672`, invoice amount `1388011` · Diesel ordered `14000`, short `28` · chambers:
  - 1: litres `4000`, before `59.8`, after `91.7`
  - 2: `4000`, `91.7`, `122.2`
  - 3: `4000`, `121.0`, `153.3`
  - 4: `2000`, `153.3`, `171.7`
  - **Save tanker**.
- [ ] **Shift A readings**: tap each grey opening › type › **Save new opening**:
  - MS-3 `126942.71`
  - MS-4 `29804.03`
  - HSD-3 `567503.44`
  - HSD-4 `947934.58`
- [ ] Shift A closings:
  - MS-3 `127165.97`
  - MS-4 `29815.57`
  - HSD-3 `570104.08`
  - HSD-4 `951594.39`
- [ ] Shift A: tick who worked · testing MS-3 `10` L and HSD-3 `10` L.
- [ ] **Shift B readings**: type the same four closings as Shift A (nothing was sold) · tick who worked.
- [ ] **Shift C readings**: the same again · tick who worked.
- [ ] **Sales › Shift A**:
  - cash in the drawer at the start `36013.04`
  - coins `22919.99`
  - Paytm `55408.10`
  - Card `2560`
  - XtraPower `1003216.67`
  - Bank transfer `0`
- [ ] Sales › Shift A: **the 29 credit slips** from the notebook (company, vehicle, slip number, fuel, ₹ or litres).
- [ ] Sales › Shift A › **Add payment from customer**:
  - Dord Logistics `365052` XtraPower
  - United Infracorp Ltd `600000` XtraPower
  - Bijay Ku Sahoo `300000` Bank transfer
  - Maa Bhawani Roadlines `300000` Bank transfer
- [ ] Sales › Shift A › **Done**.
- [ ] **Sales › Shift B**: cash in the drawer at the start `0` › **Done**. Same for **Shift C**.
- [ ] **Expenses** (all "Shift A cash drawer"):
  - Tiffin `160`
  - DG rent `15000`
  - Staff advance `100`
  - Staff food `300`
  - Tanker unloading `350`
  - Tanker driver food `200`
  - Cash advance to credit customer `11000`
- [ ] **Closing dip**: Petrol `53.2`, Diesel `119.8`.
- [ ] **Stop the stopwatch.** Open **Review and submit** and check it says:
  - **Petrol**: tank 229.54 L, meters 224.80 L, **Short −4.74 L (−2.07%)**
  - **Diesel**: tank 6,297.56 L, meters 6,250.45 L, **Short −47.11 L (−0.75%)**
  - **Shift A**: Should have ₹6,60,664.52, Received ₹6,60,664.52, **Matched**
- [ ] **Submit day**.
- [ ] **Send me**: the stopwatch time, and screenshots of Review Fuel and Money.

If any number is different, stop and send me a screenshot. That's exactly what this test is for.

### A4. Offline check (3 minutes, optional but useful)
- [ ] Open today's day › **Opening dip** › turn on **airplane mode** › type a dip in both tanks.
- [ ] The top right says **"Offline · 2 waiting"**. Send me a screenshot.
- [ ] Turn airplane mode off. Within 20 seconds it says **Saved**.

---

## Part B · Nightly backup (I build it; you add 2 passwords, 10 minutes)
- [ ] Wait for my message "backup is ready", then follow the click-by-click steps I send. You'll add `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` to GitHub.
- [ ] Write the passphrase on paper and keep it safe. Without it, the backups can't be opened.
- [ ] I run the first backup and the restore test, and tell you the result.

## Part C · Clean-up (you, 2 minutes, only after Part B works)
- [ ] Paste `supabase/cleanup/remove-test-days.sql` in the SQL Editor (it **deletes** all test days; that's intended).
- [ ] Supabase › **Authentication** › Users › delete `manager.test@users.pumphisaab.com`.

## Part D · The real app (I build it, about 20 minutes)
- [ ] Install **PumpHisaab** from the link I send. It replaces the old development app. Sign in as `subham`.

## Part E · Real setup (you, about 20 minutes, in PumpHisaab)
- [ ] Profile › **Logins** › add each manager (username + password to give them).
- [ ] Profile › **Staff** › add every attendant.
- [ ] Today: check the price is right. Tanker: check the diesel margin chip shows **₹2.60**.

## Part F · Managers start
- [ ] I send you the install link and a one-page **Manager guide**. Forward both on WhatsApp.
- [ ] Sit with each manager for their first day.

## Part G · Every day after that
- Managers fill the day in the app; the notebook continues as before.
- Every evening: open **Review and submit** for the day and compare it with the notebook.
- Anything different, or anything confusing: send me a screenshot. I fix it and send it to **Preview** first. You check it there, then I send it to the managers' app.
