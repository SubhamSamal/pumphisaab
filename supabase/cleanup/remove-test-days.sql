-- ████████████████████████████████████████████████████████████████████████████
-- ██  DANGER: THIS FILE DELETES DATA.  It is NOT a migration.                  ██
-- ██  Paste it ONLY when you decide the pilot starts (D45). It can't be undone. ██
-- ████████████████████████████████████████████████████████████████████████████
--
--  Pre-pilot clean-up · Shree Lokanath Filling Station
--
--  WHAT IT DELETES (only for this pump):
--    • Every business day typed while testing, with everything on it: dips, shifts, meter
--      readings, testing, attendants, tankers (and chambers), cash counts, payments, credit
--      slips, payments from customers, expenses.
--    • The manager.test login's link to the pump (the person can't open the pump any more).
--
--  WHAT IT KEEPS: the pump, tanks, dip chart, nozzles, prices and margins, payment types,
--    notes, expense types, staff, credit customers, the owner's login, and the audit log
--    (nobody can delete the audit log, so the history of the test entries stays there).
--
--  WHAT IT SETS: the pump's first day in the app = the pilot's first day (below), so
--    "submit yesterday first" starts counting from then.
--
--  HOW TO USE:
--    1. Check the pilot start date on the line marked ▶ (default: today's business day).
--    2. Supabase › SQL editor › New query › paste the whole file › Run.
--    3. It prints how many days were removed. Then, in Supabase › Authentication › Users,
--       delete the user manager.test@users.pumphisaab.com yourself (one click).
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_pump uuid;
  v_pilot_start date;
  v_days int;
begin
  select id into v_pump from public.pumps where name = 'Shree Lokanath Filling Station';
  if v_pump is null then
    raise exception 'Pump not found. Nothing was changed.';
  end if;

  v_pilot_start := public.current_business_date(v_pump);   -- ▶ or a date: '2026-10-01'::date

  select count(*) into v_days from public.business_days where pump_id = v_pump;

  -- Locked days can't be changed, so every day is opened first (logged in the audit log).
  update public.business_days set status = 'DRAFT', owner_opened = false, locked_by = null, locked_at = null
  where pump_id = v_pump;

  delete from public.expenses          where pump_id = v_pump;
  delete from public.customer_payments where pump_id = v_pump;
  delete from public.credit_sales      where pump_id = v_pump;
  delete from public.cash_counts       where pump_id = v_pump;
  delete from public.shift_payments    where pump_id = v_pump;
  delete from public.receipt_chambers  where pump_id = v_pump;
  delete from public.receipt_lines     where pump_id = v_pump;
  delete from public.tanker_receipts   where pump_id = v_pump;
  delete from public.nozzle_tests      where pump_id = v_pump;
  delete from public.nozzle_readings   where pump_id = v_pump;
  delete from public.shift_attendants  where pump_id = v_pump;
  delete from public.shifts            where pump_id = v_pump;
  delete from public.tank_readings     where pump_id = v_pump;
  delete from public.business_days     where pump_id = v_pump;

  delete from public.pump_members where pump_id = v_pump and username = 'manager.test';

  update public.pumps set first_business_date = v_pilot_start where id = v_pump;

  raise notice 'Removed % test days. The pilot starts on %.', v_days, to_char(v_pilot_start, 'DD Mon YYYY');
end $$;

-- Optional, only if the test companies should go too (a company used on a real slip can't be removed):
-- delete from public.credit_customers
-- where pump_id = (select id from public.pumps where name = 'Shree Lokanath Filling Station')
--   and name in ('SVT', 'Dord Logistics', 'Maa Bhawani');
