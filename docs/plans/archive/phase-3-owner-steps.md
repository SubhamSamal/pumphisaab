# Phase 3: your steps (about 30-45 minutes)

Do these in order. Each step says exactly where to click. If anything looks different from what's written, stop and send me a screenshot.

Supabase dashboard: https://supabase.com/dashboard → project **pumphisaab**.

---

## Step 1. Two login settings (2 minutes)

1. **Authentication › Sign In / Providers › Email**
   - Turn **off** "Confirm email" → **Save**.
   *(Logins use a hidden email that never receives mail, so it can't be confirmed.)*
2. **Authentication › Sign In / Providers** (top of the same page, "User Signups")
   - Turn **off** "Allow new users to sign up" → **Save**.
   *(Only you create logins, from the app. Nobody can sign themselves up.)*

## Step 2. Create your own login (2 minutes)

**Authentication › Users › Add user › Create new user**
- Email: `subham@users.pumphisaab.com`
- Password: choose a strong one (at least 8 characters). Keep it safe; this is the owner login.
- Tick **Auto Confirm User** → **Create user**.

Do this **before** Step 4, so the setup can link this login to your pump as Owner.

## Step 3. Send me two public values (1 minute)

**Project Settings › API Keys** (older dashboards: **Project Settings › API**)
- **Project URL** (looks like `https://abcdefgh.supabase.co`)
- **anon / public key** (older name) or **publishable key** (newer name, starts with `sb_publishable_`)

Paste both in our chat. They are public values, safe to share. **Never** send the `service_role` / `secret` key; the app doesn't need it.

## Step 4. Paste the 4 database files (15 minutes)

For each file, in this order:
1. Open the link below, click **Raw**, select all (Cmd+A), copy (Cmd+C).
2. In Supabase: **SQL Editor › New query**, paste, read the **DATA SAFETY** line at the top, then **Run**.
3. You should see "Success. No rows returned". If you see an error, stop and send me the message.

| # | File | Data safety |
|---|---|---|
| 1 | [20260926120000_foundations.sql](https://github.com/SubhamSamal/pumphisaab/blob/main/supabase/migrations/20260926120000_foundations.sql) | Creates new things only |
| 2 | [20260926120100_setup_tables.sql](https://github.com/SubhamSamal/pumphisaab/blob/main/supabase/migrations/20260926120100_setup_tables.sql) | Creates new things only |
| 3 | [20260926120200_calc_functions.sql](https://github.com/SubhamSamal/pumphisaab/blob/main/supabase/migrations/20260926120200_calc_functions.sql) | Creates new functions only |
| 4 | [20260926120300_seed_pilot_pump.sql](https://github.com/SubhamSamal/pumphisaab/blob/main/supabase/migrations/20260926120300_seed_pilot_pump.sql) | Adds rows only (your pump's setup) |

Each file refuses to run twice or out of order, so a mistake can't damage anything.

## Step 5. Run this check and send me the result (1 minute)

**SQL Editor › New query**, paste, **Run**, and send me a screenshot of the result:

```sql
select
  (select string_agg(name, ', ' order by name) from public.schema_migrations_applied) as migrations,
  (select name from public.pumps) as pump,
  (select count(*) from public.dip_chart_rows) as chart_rows,
  (select string_agg(label || ' ' || capacity_l, ', ' order by label) from public.tanks) as tanks,
  (select string_agg(label, ', ' order by sort_order) from public.nozzles where in_use) as nozzles_in_use,
  (select string_agg(product || ' ' || per_litre, ', ' order by product) from public.fuel_prices) as prices,
  (select string_agg(username || ' ' || role, ', ') from public.pump_members) as logins,
  (select count(*) from public.audit_log) as audit_rows;
```

Expected: 4 migrations · Shree Lokanath Filling Station · 211 · HSD-1 21628.93, MS-1 21628.93 · MS-3, MS-4, HSD-3, HSD-4 · HSD 101.74, MS 110.07 · subham OWNER · about 249.

If **logins** is empty, Step 2 wasn't done first. Create the login, then run this one line:
```sql
select private.link_member((select id from public.pumps), 'subham@users.pumphisaab.com', 'subham', 'Subham Samal', 'OWNER');
```

## Step 6. Add the login function (5 minutes)

1. Open [supabase/functions/create-user/index.ts](https://github.com/SubhamSamal/pumphisaab/blob/main/supabase/functions/create-user/index.ts) → **Raw** → copy all.
2. Supabase: **Edge Functions › Deploy a new function › Via Editor**.
3. Name it exactly **`create-user`**.
4. Replace the sample code with what you copied → **Deploy function**.
5. Open the function's **Settings** and make sure **Verify JWT** (JWT verification) is **on**.

## Step 7. Sign in and create the test manager (5 minutes, after I confirm Steps 3-6)

1. On your Mac: I'll give you one command to start the app. Open it in the browser (press `w`) or scan with Expo Go on your iPhone.
2. Sign in as **subham** with your password.
3. **Profile › Logins › Add manager**: full name "Test Manager", username `manager.test`, a password.
4. Sign out, sign in as `manager.test`: you should see Today · Sales · Tanker · Profile (no Dashboard), and Profile shows Staff but not Logins.
5. As `manager.test`, add a staff name in **Profile › Staff**.

## Step 8. Android phone (when it's charged)

I'll send you a link to install our own PumpHisaab development app (an APK). Android will ask to allow installing from your browser; allow it once.
