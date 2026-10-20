# Your checklist

**Start at step 1 and go down.** Updated 20 Oct 2026.
Done so far: nightly backup is on (09 Oct); the app is live with both managers since 1 Oct; round 1 of fixes is in the real app; "Cash deposited in bank" removed from customer payments in the real app 13 Oct (Profile line "update 01a1347").

---

## 1. Backup — done 09 Oct ✅
Runs every night at 2 AM; GitHub emails you if a night fails. The first restore test passed (11 days, 31 slips, 3 logins came back). Keep the passphrase paper safe.

## 1b. Days 1-5 Oct (from the notebooks)
- [x] Review for 01-05 Oct checked against the notebooks (13 Oct), incl. 05 Oct C cash and the 05 Oct tanker price.
- [x] 01-05 Oct submitted in order (13 Oct). Managers carry on from 06 Oct.
- [x] Preview check passed: "Cash deposited in bank" is gone from customer payments. Sent to the managers' app 13 Oct (update 01a1347).
- [ ] Each manager: close and reopen PumpHisaab twice; Profile should show "update 01a1347".
- [ ] Send Claude the formula for "Sold as per sales amount" (with one worked day) if you want it in the next phase.

## 1c. Days 6-19 Oct (from the notebooks) — PAUSED until you send the photos — plan: `docs/plans/fill-6-to-19-oct.md`
**Now (before "go"):**
- [ ] Answer Claude's 7 questions (Q1-Q7), e.g. "1A 2A 3A 4A (nozzles …) 5A 6A 7A".
- [ ] Send photos of the missing pages (one photo per page, flat and in daylight):
  - Shift book: 06-12 Oct (all shifts), 13 A, 14 (all), 15 (all), 16 C, 17 (all), 18 (all), 19 A.
  - Summary book: 15, 16, 17, 18, 19 Oct.
  - Tanker register: the 07, 09/10, 12, 15/16 Oct tankers (and 19 Oct if there was one).
  - Stock register: 18 and 19 Oct.

**After you say "go":**
- [ ] Step 1: Supabase › SQL editor › New query › paste the whole of `supabase/fixes/2026-10-20-read-days-6-to-19-oct.sql` › Run. It only reads. Click the one cell › copy › paste it to Claude.
- [ ] Step 2: when Claude sends the fill file, paste it the same way › Run. Send Claude the table at the bottom.
- [ ] Step 3: in the app, open Review for 06 Oct, compare with the notebook, Submit. Then 07 Oct, and so on in order (3-4 days at a sitting is fine).

## 2. Every day
- Managers fill the day in **PumpHisaab**; the notebook continues for now.
- Evening: open **Review and submit** for the day and compare with the notebook. Note the **petrol Difference** each day (the 1 Oct short is real; the app will track it for you in the next phases).
- Anything different or confusing: send me a screenshot. It goes into the next phase's plan unless it stops the managers working.

## 3. When you're ready for the next phase
- Phase 5a plan agreed (`docs/plans/phase-5a.md`, your answers 20 Oct).

## 3a. Phase 5a Part 1 — prices, fuel trend, time per shift (built 20 Oct)
- [ ] **Paste migration 16 first:** Supabase › SQL editor › New query › paste the whole of `supabase/migrations/20261020120000_price_requests.sql` › Run. It should say "Success. No rows returned". It only adds; nothing is deleted or changed.
- [ ] **PumpHisaab Preview:** close and reopen twice; Profile shows a new "update …" line.
- [ ] **Profile › Fuel prices:** you see diesel and petrol prices with "Now". Tap **Add new price** and look (don't save a real price unless it really changed).
- [ ] **Today:** the price strip has a **Price is different** button. Tap it, look at the box (today's prices filled in), then close it **without sending** — the Preview app uses the real database, and as owner a sent price is used at once. Use it for real only when IOCL changes the price.
- [ ] **Dashboard › Fuel trend:** 30 days of petrol and diesel Difference, with "This month" on top. Tap a day: its Review opens.
- [ ] **Time per shift:** Supabase › SQL editor › New query › paste `supabase/fixes/2026-10-20-read-time-per-shift.sql` › Run › click the one cell › copy › paste it to Claude. It only reads.
- [ ] All good → tell Claude "Part 1 OK, send to production". The managers then get the "Price is different" button (they close and reopen twice).
- Ask the managers which they read best: English, Odia or Hindi (for later).

## Reminders
- New changes always reach **PumpHisaab Preview** first. You check, then I send them to the managers. They close and reopen the app twice; no reinstall.
- Database files: paste them when I ask, before I send the update.
- Push notifications (Phase 5) will need the managers to install the app once more from a new link.
