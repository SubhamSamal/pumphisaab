# Your checklist

**Start at step 1 and go down.** Updated 09 Oct 2026.
Done so far: the app is live with both managers since 1 Oct; round 1 of fixes is in the real app (Profile line "update 01a1206").

---

## 1. Backup (10 minutes) — please do this soon
Until this is done, **real days have no backup** (the free Supabase plan doesn't keep one).
- [ ] Supabase › your project › **Connect** (top of the page) › **Session pooler** › copy the address starting `postgresql://`. Put your database password in place of `[YOUR-PASSWORD]`. (Don't know it? **Project Settings › Database › Reset database password**; the app isn't affected.)
- [ ] GitHub › **SubhamSamal/pumphisaab** › **Settings** › **Secrets and variables** › **Actions** › **New repository secret** › Name `SUPABASE_DB_URL`, Value: that address › **Add secret**.
- [ ] **New repository secret** › Name `BACKUP_PASSPHRASE`, Value: a long phrase only you know (e.g. five random words) › **Add secret**. **Write the phrase on paper**; without it the backups can't be opened.
- [ ] Tell me. I run the first backup and a restore test and send you the result. From then on it runs every night at 2 AM; GitHub emails you if a night fails.

## 2. Every day
- Managers fill the day in **PumpHisaab**; the notebook continues for now.
- Evening: open **Review and submit** for the day and compare with the notebook. Note the **petrol Difference** each day (the 1 Oct short is real; the app will track it for you in the next phases).
- Anything different or confusing: send me a screenshot. It goes into the next phase's plan unless it stops the managers working.

## 3. When you're ready for the next phase
- Tell me "plan Phase 5". I'll write the plan with your pilot list folded in (staff-wise entry, nozzle measure checks, the UI audit, PhonePe, "not settled", flags, alerts and push), ask the MCQs, and wait for your "go".
- Ask the managers which they read best: English, Odia or Hindi (for later).

## Reminders
- New changes always reach **PumpHisaab Preview** first. You check, then I send them to the managers. They close and reopen the app twice; no reinstall.
- Database files: paste them when I ask, before I send the update.
- Push notifications (Phase 5) will need the managers to install the app once more from a new link.
