# Phase 3 plan: Foundations

Status: **plan, waiting for owner "go"** · Written 26 Sep 2026 · Estimate 5-6 working days (+ the owner's setup steps, about 30-45 minutes in total)

## Goal in one line
At the end of this phase, you and a manager each **log in on your own phones**, see only your own pump, the pump's real setup (tanks, chart, nozzles, prices) is in the database, every change is recorded in an audit log, and every database change is tested automatically before you paste it into the live project.

No daily entry screens yet; those are Phase 4, slice by slice.

## What gets built

### A. Database safety net (decision D16)
- A `supabase/` folder in the repo holding every database change as a numbered migration file, and database tests (pgTAP).
- **GitHub builds a throwaway database on every push**: it applies all migrations from zero, then runs the database tests. The live project is never touched by GitHub or by me.
- **Migration ledger:** every migration ends by writing its own name into a `schema_migrations_applied` table. A read-only query lets us check the live database has exactly the migrations the repo has, in order, none skipped.
- **Warning header on every migration**, as CLAUDE.md requires: whether it can DROP, ALTER or TRUNCATE existing data. Phase 3 migrations only create things; none touch existing data.

### B. The first tables (only what login and setup need; the rest come with each Phase 4 slice)
| Table | What it holds |
|---|---|
| `pumps` | Name, OMC, address, day start time (06:00), **rules** (same shape as `src/calc/rules.ts`) |
| `pump_members` | Which login belongs to which pump, as Owner or Manager; username, full name, active |
| `dip_charts` + `dip_chart_rows` | Charts, **versioned**: a new upload is a new version, old ones are never edited |
| `tanks` | MS-1, HSD-1, product, chart version, capacity (= chart's last row) |
| `nozzles` | MS-1..4, HSD-1..4, product, tank, **in use** (1 and 2 off) |
| `shift_templates` | A 06-14, B 14-22, C 22-06, with the date they start from |
| `fuel_prices` | Product, ₹/L, start date |
| `payment_types` | Cash, Paytm, Card, XtraPower, Bank transfer, Credit (D25) |
| `cash_denominations` | ₹500, 200, 100, 50, 20, 10 + coins |
| `expense_categories` | The 10 types (D33), default fixed/variable, optional daily cap |
| `credit_customers`, `staff` | Names, active |
| `audit_log` | Every insert, update and delete on every table: who, when, old and new values |
| `schema_migrations_applied` | The ledger (A) |

Every table has `id`, `pump_id` (except `pumps`), `created_by/at`, `updated_by/at`, a **row version** (to catch two people editing the same thing), **RLS on**, and the **audit trigger** (hard rule 5). A database test fails if any table is missing one of these.

### C. Security (Row Level Security)
- Helper functions: "which pumps am I a member of", "am I the owner of this pump".
- **Everyone** can read their own pump's setup. **Only the owner** can change setup, prices, logins and rules. Nobody can read another pump's rows.
- Database tests prove it: a manager of Pump X can't read or write Pump Y (PRD acceptance 17), a manager can't change a price, nobody can edit or delete the audit log.

### D. Maths in the database, first pieces (hard rule 4)
- `dip_to_litres(chart, cm)`: same straight-line reading as the app.
- `current_business_date(pump)`: 06:00 IST day start, from the **server's** clock (D17).
- `price_for(pump, product, date)`.
- A small script turns the golden cases (`tests/golden/cases/*.json`) into database tests, so the dip, price and business-date answers must match the app's exactly. (Shift and day matching follow in Phase 4 as those tables arrive.)

### E. Your pump's setup, loaded once (seed migration)
Pump, the real dip chart (211 rows), MS-1 and HSD-1, 8 nozzles (1 and 2 not in use), shifts, payment types, notes, expense types, credit customers from the notebook, prices, and default rules. It also links **your** login to the pump as Owner.

### F. Login
- **Username + password** (no email, no OTP). Behind the scenes Supabase needs an email, so each username gets a hidden one on a domain we control (question 3 below).
- **Sign in screen** exactly as canvas Flow 1: logo, username, password with Show, "Keep me signed in", "Forgot password? Ask the owner to reset it."
- Stay signed in on the phone; sign out in Profile.
- The app's tabs follow the **real role** from the database; the developer-only Owner/Manager switch is removed.
- **Screens for states:** loading (grey blocks), "The pump isn't set up yet" for a manager, error with retry.

### G. Owner creates manager logins
- A small secure server function (**Edge Function** `create-user`) creates or resets a manager's login. It runs on Supabase's servers with the secret service key, which never goes in the app (hard rule 11). It checks the caller is the pump's owner.
- A minimal **Profile › Logins** screen (canvas Flow 13): add manager (full name, username, password), reset password, switch off. The rest of the settings screens stay in Phase 6.

### G2. Staff list (D38)
- **Profile › Staff:** add a name, rename, switch off. Owner and managers can both do this. These names become the attendant chips on each shift in Phase 4.

### H. Our own app build and instant fixes (D17)
- **Android package ID** (permanent, question 1).
- **Development build** of the app for your Android phone via EAS (a real installable APK, replaces Expo Go on Android). Needed for push notifications later.
- **EAS Update:** fixes reach phones in minutes without reinstalling. Two channels: `preview` (you) and `production` (pilot).
- **iPhone:** a development build needs a paid Apple developer account (US$99/year), which isn't in scope. Your iPhone keeps using Expo Go, which still works for everything in Phases 3-4 except push.

### I. Libraries this adds (CLAUDE.md: ask first)
| Library | Why | In the CLAUDE.md stack? |
|---|---|---|
| `@supabase/supabase-js` | Talk to the database and login | Yes (Supabase) |
| `supabase` (CLI, dev only) | Migrations and database tests in CI | Yes (Supabase) |
| `@tanstack/react-query` | Loading and caching data | Yes |
| `react-hook-form` + `zod` | The sign-in and add-manager forms | Yes |
| `expo-updates` | Instant fixes (EAS Update) | New, decided in D17 |
| `expo-dev-client` | Our own development build | New, decided in D17 |

## What I'll need from you (after "go", with exact click-by-click steps)
1. **Supabase dashboard:** copy the project URL and anon (public) key into a `.env` file on this Mac (I'll tell you exactly where); turn off "Confirm email"; create your own login user.
2. **Paste the migrations** into the SQL editor, in the order I give, after reading each one's warning header. Then run one check query I give you and paste me the result.
3. **Deploy the `create-user` function** (method: question 2).
4. **Android phone:** install the development build APK from a link.
5. **Create the test manager** `manager.test` from Profile › Logins and log in with it once.

## Tests and checks
- App: typecheck, lint, all Vitest tests (65 today + login form + session handling).
- Database (in CI): every migration applies from zero; every table has the required columns, RLS and audit trigger; RLS isolation between two pumps; owner-only writes; audit log fills on every change and can't be edited; golden cases for dip, price and business date match the app.
- By hand: you and a test manager log in on your phones and on the web; each sees the right tabs; the manager can't reach owner screens.

## Owner decisions for this phase (26 Sep 2026)
- Android package ID `com.pumphisaab.app` (D34)
- You paste Edge Functions in the dashboard; I never deploy to live (D35)
- Hidden login email `<username>@users.pumphisaab.com` (D36)
- Seed: setup + prices MS ₹110.07 / HSD ₹101.74 from 15 Sep 2026; no credit customers or staff (D37)
- Staff added in the app by owner or managers (D38)
- Your username `subham`; test manager `manager.test` (D39)
- Sentry moves to Phase 4; iPhone stays on Expo Go (D40)

## Not in this phase
Daily entry tables and screens (Phase 4 slices), flags, push notifications, owner notes (Phase 5), full settings screens (Phase 6), PostHog (Phase 6), Sentry (Phase 4), credit customers screen (Phase 4, with credit slips), backups decision (before Phase 5).

## Exit check
- You and one manager log in on your phones and web and see the right tabs and your pump's setup.
- RLS test proves Pump X can't see Pump Y.
- CI green including database tests; migration ledger on the live database matches the repo.
- Audit log shows the setup rows and your login changes.
- An EAS Update reaches your Android phone.
