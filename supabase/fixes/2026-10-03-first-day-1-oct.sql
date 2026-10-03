-- ════════════════════════════════════════════════════════════════════════════
--  One-off fix · 03 Oct 2026 · the pilot's first day is 1 Oct 2026, not 15 Sep (owner)
--
--  WHAT IT DOES
--    • Sets the pump's first day in the app to 01 Oct 2026, so "submit yesterday first" starts
--      counting from 1 Oct.
--    • Removes the EMPTY days before 1 Oct (opened only by tapping back through the dates:
--      no dips, readings, tankers, money, slips or expenses on them) and their empty shifts.
--      A day before 1 Oct with anything typed on it is KEPT (and listed at the end).
--
--  DATA SAFETY:  DELETES ONLY EMPTY DAYS before 01 Oct 2026. Nothing typed is deleted.
--  HOW TO APPLY: Supabase › SQL editor › paste › Run. Safe to run twice.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_pump uuid;
  v_removed int;
  v_kept text;
begin
  select id into v_pump from public.pumps where name = 'Shree Lokanath Filling Station';
  if v_pump is null then raise exception 'Pump not found. Nothing was changed.'; end if;

  update public.pumps set first_business_date = '2026-10-01' where id = v_pump;

  create temp table empty_days on commit drop as
  select d.id from public.business_days d
  where d.pump_id = v_pump and d.business_date < '2026-10-01' and d.status = 'DRAFT'
    and not exists (select 1 from public.tank_readings x where x.day_id = d.id)
    and not exists (select 1 from public.nozzle_readings x where x.day_id = d.id)
    and not exists (select 1 from public.nozzle_tests x where x.day_id = d.id)
    and not exists (select 1 from public.shift_attendants x where x.day_id = d.id)
    and not exists (select 1 from public.tanker_receipts x where x.day_id = d.id)
    and not exists (select 1 from public.shift_payments x where x.day_id = d.id)
    and not exists (select 1 from public.cash_counts x where x.day_id = d.id)
    and not exists (select 1 from public.credit_sales x where x.day_id = d.id)
    and not exists (select 1 from public.customer_payments x where x.day_id = d.id)
    and not exists (select 1 from public.expenses x where x.day_id = d.id);

  delete from public.shifts where day_id in (select id from empty_days);
  delete from public.business_days where id in (select id from empty_days);
  get diagnostics v_removed = row_count;

  select string_agg(to_char(business_date, 'DD Mon'), ', ' order by business_date) into v_kept
  from public.business_days where pump_id = v_pump and business_date < '2026-10-01';

  raise notice 'First day is now 01 Oct 2026. Removed % empty days before it.%', v_removed,
    coalesce(' Kept (they have entries): ' || v_kept, '');
end $$;
