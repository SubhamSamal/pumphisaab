# Owner's manual: Phase 5a Part 3

**21 Oct 2026.** Do the steps in order. If something looks different, send Claude a screenshot.

## Step 1. Paste database update 18
1. Open https://github.com/SubhamSamal/pumphisaab/blob/main/supabase/migrations/20261021130000_settlement_pending.sql
2. Click **Raw**. Press **Ctrl/Cmd + A**, then **Ctrl/Cmd + C**.
3. In Supabase, open the project **pumphisaab** › **SQL Editor** › **+ New query**. Paste, then click **Run**.
4. You should see **"Success. No rows returned"**. Any other red message: send it to Claude and don't run it again.
- [ ] Done

## Step 2. Update PumpHisaab Preview
1. **Profile** › **Check for update**. The app reopens by itself.
2. **Profile** should show **"update UPDATE_ID"**.
- [ ] Done

## Step 3. Today
1. The first card not done has a teal **Next** tag.
2. Done cards are one short line.
- [ ] Done

## Step 4. A shift's Sales
1. **Sales** › open a shift.
2. Parts are numbered **1 Cash · 2 Paytm, card… · 3 Credit slips · 4 Payments from customers**. Each turns into a green tick when filled.
3. The bottom bar always shows **Received** and the **Difference**.
4. On the number pad, **Next** jumps from cash to each payment box.
5. A small green **Saved** appears beside a box after you leave it.
- [ ] Done

## Step 5. Not settled yet
1. **Sales** › **By type**.
2. Paytm, PhonePe, XtraPower and cards each have a **Not settled yet (optional)** box. It never changes the money check.
3. **Review** › step 2 (Money) shows them under **Not settled yet**.
- [ ] Done

## Step 6. Tanker
1. **Tanker** › **Add tanker** (look only; don't save unless a tanker really came).
2. **Step 1 Challan:** tanker number, invoice amount, invoice no., litres ordered and short. The invoice date shows **today · Change**.
3. **Next: Chambers** › **Step 2 Chambers:** chambers and dips. The price chips are in the totals at the bottom.
- [ ] Done

## Step 7. Opening dip
1. **Opening dip:** the dip box comes first, then **IOCL stock (DSR), optional**.
- [ ] Done

## Step 8. Send to the managers
1. Tell Claude: **"Part 3 OK, send to production"**.
2. Tell the managers: **Profile › Check for update**.
- [ ] Done
