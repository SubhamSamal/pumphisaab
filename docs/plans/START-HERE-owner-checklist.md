# Your checklist

**Start at step 1 and go down. Tick each box.** Where it says "Send me", send it before going on.
Updated 03 Oct 2026, after the managers' demo. Earlier steps (clean-up, real app, logins, demo) are done.

---

## 1. Make 1 Oct the first day (2 minutes) — unblocks Submit
- [ ] Supabase › **SQL Editor** › **New query**.
- [ ] Open `supabase/fixes/2026-10-03-first-day-1-oct.sql`, copy all, paste, **Run**.
- [ ] The message says **"First day is now 01 Oct 2026. Removed N empty days before it."** (If it also lists "Kept…" days, those have entries; tell me and I'll sort them.)
- [ ] **Send me** the message.

## 2. Paste migration 14 (2 minutes) — needed before the new update
- [ ] **New query** › open `supabase/migrations/20261003120000_pilot_fixes_1.sql` › read **DATA SAFETY** (adds a "next day" mark for tanker chambers, lets managers go back 10 days, renames Card → Debit card and adds Credit card; nothing deleted) › paste › **Run**.
- [ ] Check: `select count(*) from schema_migrations_applied;` → **14**.
- [ ] **Send me** "done". I then send the new version to **PumpHisaab Preview** (about 5 minutes).

## 3. Check the new version on PumpHisaab Preview (15 minutes)
Close Preview fully and open it, twice (the update downloads on the first open, shows on the second). Profile's bottom line shows a new "update …".
- [ ] **Shift readings › Who worked:** a tick list; a tick appears the moment you tap (the row greys for a second while it saves).
- [ ] **Shift readings › Testing:** "Nozzle tested" is a drop-down (tap › pick one from the list).
- [ ] **Expenses › Add:** "Where did the money come from?" is a drop-down.
- [ ] **Sales › a shift › Add payment from customer:** "How was it paid?" is a drop-down. Payment types now show **Debit card** and **Credit card**.
- [ ] **Credit slip:** Slip number comes before Vehicle number; the grey example text ("e.g. 4471") is very light.
- [ ] **Tanker › Add tanker** with 2+ chambers: switch **"Unloading finished next day"** on, pick **"Next day from chamber"**: those chambers say **Next day**. Save. (On a test day only, or remove it after.)
- [ ] The next day's **Tanker** card says "… L from yesterday's <tanker number>".
- [ ] **Profile › Nozzles** (owner only): nozzles 1 and 2 show; switching one on makes it appear on every shift.
- [ ] As a manager: Today's ‹ arrow goes back **10 days**.
- [ ] **Send me** "Preview OK" (or what's wrong). I then send it to the managers' **PumpHisaab**; they close and reopen the app twice. No reinstall.

## 4. Backup (10 minutes)
- [ ] Supabase › your project › **Connect** (top of the page) › **Session pooler** › copy the address starting `postgresql://`. Put your database password in place of `[YOUR-PASSWORD]`. (Don't know it? **Project Settings › Database › Reset database password**; the app isn't affected.)
- [ ] GitHub › **SubhamSamal/pumphisaab** › **Settings** › **Secrets and variables** › **Actions** › **New repository secret** › Name `SUPABASE_DB_URL`, Value: that address › **Add secret**.
- [ ] **New repository secret** › Name `BACKUP_PASSPHRASE`, Value: a long phrase only you know (e.g. five random words) › **Add secret**. **Write the phrase on paper**; without it the backups can't be opened.
- [ ] Tell me. I run the first backup and a restore test and send you the result. From then on it runs every night at 2 AM; GitHub emails you if a night fails.

## 5. Every day
- Managers fill the day; the notebook continues for now.
- Evening: open **Review and submit** for the day and compare with the notebook. Anything different or confusing: send me a screenshot.
- Fixes go to **Preview** first → you check → then the managers' app. Database changes come as a file you paste first.

## Answers from the demo (for you to tell the managers)
- **Sold between two chambers:** already handled. Each chamber has its own dip before and after, so a sale in between doesn't spoil anything.
- **Tanker finished next day:** switch "Unloading finished next day" on the tanker and pick the chamber it restarted from.
- **Emergency sale during unloading:** avoid it; if it happens, tell the owner. The totals stay right; only that chamber's dip check shows yellow.
- **Who changed what:** every save, edit and delete is kept with the person's name, the time, and the old and new value.
