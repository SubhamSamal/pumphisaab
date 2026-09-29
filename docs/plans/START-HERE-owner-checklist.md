# Your checklist: go live with the managers

**Start at step 1 and go down. Tick each box.** Where it says "Send me", send it before going on.
(Rewritten 29 Sep. Migration 13 is done. The earlier test steps are skipped: the managers typing real past records in front of you is the real test.)

The **first day in the app is 15 Sep 2026.** Managers type the notebook days from 15 Sep onwards, oldest first, then carry on every day.

---

## 1. Clean-up (5 minutes, now)
Removes every test day and the `manager.test` login, and makes 15 Sep the first day. Your prices, margin, tanks, staff and companies stay.
- [ ] Supabase › **SQL Editor** › **New query**.
- [ ] Open `supabase/cleanup/remove-test-days.sql`, copy all, paste, **Run**. (It says DANGER at the top because it deletes the test days; that's intended.)
- [ ] The message at the end should say: **"Removed N test days. The pilot starts on 15 Sep 2026."**
- [ ] Supabase › **Authentication** › **Users** › find `manager.test@users.pumphisaab.com` › **⋮** › **Delete user**.
- [ ] **Send me** the message.

## 2. Install the real app (5 minutes)
- [ ] Open the install link I send (on the Android phone, in Chrome) › Install. It's called **PumpHisaab** and replaces the old development app. Keep **PumpHisaab Preview** too: that's where you check changes before the managers get them.
- [ ] Open PumpHisaab › sign in as `subham`.
- [ ] Profile › the grey line at the bottom says **"App 1.0.0 · production · built-in code"**.

## 3. Set up for the managers (15 minutes, in PumpHisaab)
- [ ] Profile › **Logins** › add both managers (a username and a password for each; write them down to give them).
- [ ] Profile › **Staff** › add every attendant (they show as ticks on each shift).
- [ ] Tanker › Add tanker › the diesel **Margin** chip shows **₹2.60** (tap it to fix if not) › go back without saving.

## 4. Open the past days (2 minutes, you only)
Managers can open only today and the 2 days before; older days must be opened once by the owner.
- [ ] Today › tap **‹** until **Tue, 15 Sep 2026** (each day you pass is opened for them). Then tap **›** back to today.

## 5. Managers start (with you, as long as it takes)
- [ ] Send each manager: the install link, their username and password, and the guide (below, WhatsApp-ready).
- [ ] They install PumpHisaab and sign in.
- [ ] They type **15 Sep** from the notebook, top to bottom on Today. On this first day they type each nozzle's **opening** meter (there's nothing earlier to copy). From 16 Sep on, openings copy by themselves.
- [ ] Review and submit 15 Sep, then 16 Sep, and so on, **in order** (the app refuses a day while an earlier one isn't submitted, and says which).
- [ ] Watch where they get stuck. Note every question or problem.
- [ ] **Send me** your list (screenshots help). I fix it the same day: first to PumpHisaab Preview for you to check, then over the air to the managers' app.

Good to know while they type the past:
- A day more than 3 days old **locks as soon as it's submitted**. To fix it later, open it and tap **Unlock** (owner only), fix, submit again, and tap **Lock**. If the fix changes a closing meter, unlock the next day too (its opening follows).
- An opening that doesn't match the last closing (meter repaired, or a typo) waits for your **Approve** on that shift. It shows on Today as a banner.
- Differences show yellow and never block. Only red things block Submit.

## 6. Backup (10 minutes, today)
- [ ] Supabase › your project › **Connect** (top of the page) › **Session pooler** › copy the address starting `postgresql://`. Put your database password in place of `[YOUR-PASSWORD]`. (Don't know it? **Project Settings › Database › Reset database password**; the app isn't affected.)
- [ ] GitHub › **SubhamSamal/pumphisaab** › **Settings** › **Secrets and variables** › **Actions** › **New repository secret** › Name `SUPABASE_DB_URL`, Value: that address › **Add secret**.
- [ ] **New repository secret** › Name `BACKUP_PASSPHRASE`, Value: a long phrase only you know (e.g. five random words) › **Add secret**. **Write the phrase on paper**; without it the backups can't be opened.
- [ ] Tell me. I run the first backup and a restore test and send you the result. From then on it runs every night at 2 AM, and GitHub emails you if a night fails.

## 7. Every day after that
- Managers fill the day; the notebook continues for now.
- Evening: open **Review and submit** for the day and compare with the notebook. Anything different or confusing: send me a screenshot.
- Fixes: I send them to **PumpHisaab Preview** → you check → I send them to the managers' **PumpHisaab**. Database changes still come as a file you paste first.
- Only one future change needs the managers to reinstall (push notifications, later). I'll send a new link then.

---

## Manager guide (copy into WhatsApp)

```
*PumpHisaab: how to fill the day*

*Install (once)*
1. Open the link on your Android phone in Chrome › Install. If Android asks, allow installs from Chrome. If it warns "unknown app": More details › Install anyway.
2. Open PumpHisaab › type the username and password the owner gave you › Sign in.

*Every day, top to bottom on Today*
1. *Today's price* › check it › Confirm.
2. *Opening dip*: dip in cm for each tank (IOCL stock if you have it).
3. *Tanker*: only if a tanker came. Add tanker › challan details › each chamber's litres, dip before and dip after › Save.
4. *Shift A, B, C readings*: closing of every nozzle, tick who worked, testing litres.
5. *Sales*: for each shift: cash notes and coins, Paytm, Card, XtraPower, Bank, credit slips, payments from customers › *Done*.
6. *Expenses*: every rupee paid out, and from which shift's cash. Nothing paid out? Tap "No expenses today".
7. *Closing dip*: dip in cm for each tank.
8. *Review and submit* (last card): check Fuel, Money, Summary › Submit day.

*Colours on Summary*
🔴 Red: fix it before you can submit (the line tells you what and where).
🟡 Yellow: small difference. You can submit; the owner will see it.
🟢 Green: checks that passed.

*Good to know*
- Every box saves by itself when you leave it. "Saved" at the top means it's safe.
- No internet? Keep typing. It says "Offline · 2 waiting" and sends by itself when the internet is back.
- Pressed Back by mistake on a tanker, slip or expense? Open it again: what you typed comes back.
- A slip number can be used only once.
- Submit yesterday before today.
- A mistake after Submit? Fix it and tap Submit again. Every change is saved with your name.
- Any problem: send the owner a screenshot.
```
