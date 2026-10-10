-- DATA SAFETY: ADDS ROWS ONLY. Changes no existing row except 02-05 Oct's own day rows (price confirmed,
-- "no tanker" on 02 and 04 Oct) and their shifts (cash at start, Sales marked done). Deletes nothing.
-- Refuses to run (and changes nothing) if any of 02-05 Oct already has readings, dips, sales or expenses,
-- or is submitted. Everything runs as one step: if any line fails, nothing is saved.
--
-- What: 02-05 Oct 2026 typed from the owner's notebooks (shift book for each shift, summary book for
-- slip numbers, vehicles and litres), the same way the owner filled 01 Oct:
--   • opening and closing dips (litres from the app's chart), price confirmed (MS 110.07, HSD 101.74);
--   • per shift: who worked, meter closings (openings follow the previous shift), 5 L tests,
--     cash at start (the notebook's figure), cash counted (the notebook's balance to the rupee),
--     Paytm / PhonePe / cards / XtraPower / bank deposit totals, credit slips, payments from
--     customers, expenses paid from the drawer; Sales marked done;
--   • payments by bank transfer (Bijay ₹6,50,000 and S.V.T. ₹1,50,000 on 03 Oct) with no shift.
--   • New companies: MGM Minerals, Subrat Kumar Samal. New expense types: MS for errands,
--     Bill printing, Commission, Repairs, Cleaning.
--   • Tankers: 03 Oct WB29D9510 HSD 14,000 L (dip 50.2 → 162.2 cm, short 41 L, from the unloading
--     register) and 05 Oct OD02AV2691 HSD 20,000 L in 5 chambers of 4,000 L (chamber 5 unloaded on
--     06 Oct, 121.4 → 153.2 cm; short 78 L, chambers 1-4). Price 99.14 and margin 2.60 as on 01 Oct.
-- The days stay DRAFT: the owner checks Review and taps Submit for each day.
--
-- How: paste in Supabase › SQL editor › Run. The last table shows each day's result.

do $$
declare
  v_pump uuid;
  v_owner uuid;
  v_day uuid;
  v_shift uuid;
  v_date date;
  v_bad text;
begin
  select id into v_pump from public.pumps order by created_at limit 1;
  select user_id into v_owner from public.pump_members where pump_id = v_pump and role = 'OWNER' and is_active order by created_at limit 1;
  if v_owner is null then raise exception 'No owner found. Nothing was changed.'; end if;

  -- Refuse if anything is already there.
  foreach v_date in array array[date '2026-10-02', date '2026-10-03', date '2026-10-04', date '2026-10-05'] loop
    select d.id into v_day from public.business_days d where d.pump_id = v_pump and d.business_date = v_date;
    continue when v_day is null;
    select string_agg(t, ', ') into v_bad from (
      select 'already submitted' t from public.business_days where id = v_day and status <> 'DRAFT'
      union all select 'meter readings' from public.nozzle_readings where day_id = v_day having count(*) > 0
      union all select 'dips' from public.tank_readings where day_id = v_day having count(*) > 0
      union all select 'sales' from public.shift_payments where day_id = v_day having count(*) > 0
      union all select 'credit slips' from public.credit_sales where day_id = v_day having count(*) > 0
      union all select 'customer payments' from public.customer_payments where day_id = v_day having count(*) > 0
      union all select 'expenses' from public.expenses where day_id = v_day having count(*) > 0
      union all select 'staff' from public.shift_attendants where day_id = v_day having count(*) > 0
      union all select 'tests' from public.nozzle_tests where day_id = v_day having count(*) > 0
    ) x;
    if v_bad is not null then
      raise exception '% already has %. Nothing was changed.', to_char(v_date, 'DD Mon YYYY'), v_bad;
    end if;
  end loop;

  -- Names that 01 Oct didn't need yet.
  insert into public.credit_customers (pump_id, name, created_by) select v_pump, 'MGM Minerals', v_owner
  where not exists (select 1 from public.credit_customers where pump_id = v_pump and lower(name) = lower('MGM Minerals'));
  insert into public.credit_customers (pump_id, name, created_by) select v_pump, 'Subrat Kumar Samal', v_owner
  where not exists (select 1 from public.credit_customers where pump_id = v_pump and lower(name) = lower('Subrat Kumar Samal'));
  insert into public.expense_categories (pump_id, name, sort_order, created_by)
  select v_pump, 'MS for errands', (select coalesce(max(sort_order), 0) + 1 from public.expense_categories where pump_id = v_pump), v_owner
  where not exists (select 1 from public.expense_categories where pump_id = v_pump and lower(name) = lower('MS for errands'));
  insert into public.expense_categories (pump_id, name, sort_order, created_by)
  select v_pump, 'Bill printing', (select coalesce(max(sort_order), 0) + 1 from public.expense_categories where pump_id = v_pump), v_owner
  where not exists (select 1 from public.expense_categories where pump_id = v_pump and lower(name) = lower('Bill printing'));
  insert into public.expense_categories (pump_id, name, sort_order, created_by)
  select v_pump, 'Commission', (select coalesce(max(sort_order), 0) + 1 from public.expense_categories where pump_id = v_pump), v_owner
  where not exists (select 1 from public.expense_categories where pump_id = v_pump and lower(name) = lower('Commission'));
  insert into public.expense_categories (pump_id, name, sort_order, created_by)
  select v_pump, 'Repairs', (select coalesce(max(sort_order), 0) + 1 from public.expense_categories where pump_id = v_pump), v_owner
  where not exists (select 1 from public.expense_categories where pump_id = v_pump and lower(name) = lower('Repairs'));
  insert into public.expense_categories (pump_id, name, sort_order, created_by)
  select v_pump, 'Cleaning', (select coalesce(max(sort_order), 0) + 1 from public.expense_categories where pump_id = v_pump), v_owner
  where not exists (select 1 from public.expense_categories where pump_id = v_pump and lower(name) = lower('Cleaning'));

  -- ═══ 2026-10-02 ═══
  select id into v_day from public.business_days where pump_id = v_pump and business_date = date '2026-10-02';
  if v_day is null then
    insert into public.business_days (pump_id, business_date, created_by) values (v_pump, date '2026-10-02', v_owner) returning id into v_day;
  end if;
  perform private.ensure_shifts(v_day);
  update public.business_days set ms_price = public.price_for(v_pump, 'MS', business_date), hsd_price = public.price_for(v_pump, 'HSD', business_date),
    price_confirmed_by = v_owner, price_confirmed_at = now(), no_tanker = true where id = v_day;
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'MS-1'), 'OPENING', 83.0, v_owner);
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'MS-1'), 'CLOSING', 81.0, v_owner);
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'HSD-1'), 'OPENING', 138.6, v_owner);
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'HSD-1'), 'CLOSING', 88.8, v_owner);
  -- Shift A
  select id into v_shift from public.shifts where day_id = v_day and shift_code = 'A';
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Jitendra Kumar Sahoo'), v_owner);
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Lingaraj Behera'), v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 130967.80, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 30501.95, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 609068.56, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 1022004.27, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 5, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 5, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 5, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 5, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash'), 42114.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 41055.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'PhonePe'), 8000.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Debit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Credit card'), 4600.70, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash deposited in bank'), 0.00, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Bijay Kumar Sahoo') order by created_at limit 1), 'OD19Z3404', '4510', 'HSD', 'LITRES', 380, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('United Infracore LTD') order by created_at limit 1), 'OD34U6630', '660', 'HSD', 'LITRES', 3500, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MGM Minerals') order by created_at limit 1), 'OD19U1828', '662', 'HSD', 'LITRES', 2200, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Lingaraj Behera') order by created_at limit 1), 'OD04L5651', '5107', 'HSD', 'RUPEES', 9500, v_owner);
  insert into public.customer_payments (pump_id, day_id, shift_id, customer_id, payment_type_id, amount, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Subrat Kumar Samal') order by created_at limit 1), (select id from public.payment_types where pump_id = v_pump and name = 'PhonePe'), 8000.00, v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Commission') order by created_at limit 1), 'UIL supervisor Govind, Sept 2026', 4900.00, 'SHIFT_A', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Tanker driver food') order by created_at limit 1), 'Boxix and fooding', 600.00, 'SHIFT_A', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Tanker unloading') order by created_at limit 1), null, 350.00, 'SHIFT_A', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('MS for errands') order by created_at limit 1), 'UIL bill, MRDL', 50.00, 'SHIFT_A', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Bill printing') order by created_at limit 1), 'UIL bill', 20.00, 'SHIFT_A', v_owner);
  update public.shifts set opening_cash = 38009.18, sales_done_at = now() where id = v_shift;
  -- Shift B
  select id into v_shift from public.shifts where day_id = v_day and shift_code = 'B';
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Gurucharan Sahoo'), v_owner);
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Tuna Dehury'), v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 131091.60, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 30515.85, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 609102.38, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 1022642.89, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash'), 51702.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 24996.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'PhonePe'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Debit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Credit card'), 810.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 14206.94, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash deposited in bank'), 0.00, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Darcel Logistics LTD') order by created_at limit 1), 'RJ02GB5707', '5110', 'HSD', 'RUPEES', 34000, v_owner);
  insert into public.customer_payments (pump_id, day_id, shift_id, customer_id, payment_type_id, amount, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Raghunath Gas') order by created_at limit 1), (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 550.00, v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('TEA') order by created_at limit 1), null, 80.00, 'SHIFT_B', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Fooding Rudra') order by created_at limit 1), null, 100.00, 'SHIFT_B', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('MS for errands') order by created_at limit 1), 'Angul', 100.00, 'SHIFT_B', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('TEA') order by created_at limit 1), 'A shift tea', 40.00, 'SHIFT_B', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Repairs') order by created_at limit 1), 'Desktop repair', 200.00, 'SHIFT_B', v_owner);
  update public.shifts set opening_cash = 42114.29, sales_done_at = now() where id = v_shift;
  -- Shift C
  select id into v_shift from public.shifts where day_id = v_day and shift_code = 'C';
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Gobardhan Dalei'), v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 131102.89, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 30515.85, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 610676.57, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 1024174.23, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash'), 53969.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 6254.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'PhonePe'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Debit card'), 1500.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Credit card'), 4380.92, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 24277.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash deposited in bank'), 0.00, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35H0084', '5111', 'HSD', 'RUPEES', 13500, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AB1745', '5112', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC3806', '5113', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0404', '5114', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AD3939', '5115', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J4300', '5116', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0552', '5117', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K0084', '5118', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC0084', '5119', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AB0084', '5120', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J6080', '5121', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0572', '5122', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0594', '5123', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AB1776', '5124', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD15Q8284', '5125', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD04MK2077', '5126', 'HSD', 'RUPEES', 13000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J8551', '5127', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K1079', '5128', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J9775', '5130', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('TEA') order by created_at limit 1), null, 20.00, 'SHIFT_C', v_owner);
  update public.shifts set opening_cash = 51702.04, sales_done_at = now() where id = v_shift;
  if (select sum(rupees) from public.credit_sales where day_id = v_day) <> 940579.20 then
    raise exception '2026-10-02: credit slips don''t add up to the notebook''s ₹940579.20. Nothing was changed.';
  end if;

  -- ═══ 2026-10-03 ═══
  select id into v_day from public.business_days where pump_id = v_pump and business_date = date '2026-10-03';
  if v_day is null then
    insert into public.business_days (pump_id, business_date, created_by) values (v_pump, date '2026-10-03', v_owner) returning id into v_day;
  end if;
  perform private.ensure_shifts(v_day);
  update public.business_days set ms_price = public.price_for(v_pump, 'MS', business_date), hsd_price = public.price_for(v_pump, 'HSD', business_date),
    price_confirmed_by = v_owner, price_confirmed_at = now(), no_tanker = false where id = v_day;
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'MS-1'), 'OPENING', 81.0, v_owner);
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'MS-1'), 'CLOSING', 78.8, v_owner);
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'HSD-1'), 'OPENING', 88.8, v_owner);
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'HSD-1'), 'CLOSING', 149.2, v_owner);
  -- Shift A
  select id into v_shift from public.shifts where day_id = v_day and shift_code = 'A';
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Gurucharan Sahoo'), v_owner);
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Tuna Dehury'), v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 131177.08, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 30530.57, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 611235.74, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 1024248.33, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 5, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 5, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 5, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 5, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash'), 61507.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 28560.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'PhonePe'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Debit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Credit card'), 220.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 3000.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash deposited in bank'), 0.00, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Bijay Kumar Sahoo') order by created_at limit 1), 'OD19Z3404', '4511', 'HSD', 'LITRES', 385, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Lingaraj Behera') order by created_at limit 1), 'OD04L5651', '4540', 'HSD', 'RUPEES', 7500, v_owner);
  insert into public.customer_payments (pump_id, day_id, shift_id, customer_id, payment_type_id, amount, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Lingaraj Behera') order by created_at limit 1), (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 14000.00, v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Cleaning') order by created_at limit 1), 'Surf', 20.00, 'SHIFT_A', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('TEA') order by created_at limit 1), null, 40.00, 'SHIFT_A', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('MS for errands') order by created_at limit 1), 'K.Bania (Rudra)', 50.00, 'SHIFT_A', v_owner);
  update public.shifts set opening_cash = 53969.43, sales_done_at = now() where id = v_shift;
  -- Shift B
  select id into v_shift from public.shifts where day_id = v_day and shift_code = 'B';
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Jitendra Kumar Sahoo'), v_owner);
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Lingaraj Behera'), v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 131329.81, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 30564.24, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 613037.17, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 1025334.82, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash'), 27644.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 27845.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'PhonePe'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Debit card'), 1000.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Credit card'), 11000.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 124021.72, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash deposited in bank'), 50000.00, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Darcel Logistics LTD') order by created_at limit 1), 'BR11GG2936', '5139', 'HSD', 'RUPEES', 31500, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('IIC Motanga PS') order by created_at limit 1), 'OD05AG5388', '4145', 'HSD', 'LITRES', 200, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('IIC Motanga PS') order by created_at limit 1), 'OD05CA2974', '1841', 'MS', 'LITRES', 25, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K1065', '5146', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K0673', '5147', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0486', '5148', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'WB41K2687', '5149', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC3885', '5150', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K1032', '5151', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.customer_payments (pump_id, day_id, shift_id, customer_id, payment_type_id, amount, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Lingaraj Behera') order by created_at limit 1), (select id from public.payment_types where pump_id = v_pump and name = 'Cash'), 10500.00, v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('MS for errands') order by created_at limit 1), 'Bank (Rudra)', 50.00, 'SHIFT_B', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Fooding Rudra') order by created_at limit 1), null, 100.00, 'SHIFT_B', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('TEA') order by created_at limit 1), null, 80.00, 'SHIFT_B', v_owner);
  update public.shifts set opening_cash = 61506.64, sales_done_at = now() where id = v_shift;
  -- Shift C
  select id into v_shift from public.shifts where day_id = v_day and shift_code = 'C';
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Gobardhan Dalei'), v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 131336.68, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 30565.78, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 614590.40, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 1026468.96, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash'), 32556.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 14436.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'PhonePe'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Debit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Credit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 208165.49, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash deposited in bank'), 0.00, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Darcel Logistics LTD') order by created_at limit 1), 'RJ11GC7466', '5157', 'HSD', 'RUPEES', 31800, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K0866', '5152', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K1011', '5153', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC3939', '5154', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD23E5599', '5155', 'HSD', 'RUPEES', 11000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35H7770', '5156', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0628', '5158', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35H9941', '5159', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AB1745', '5160', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC3485', '5161', 'HSD', 'RUPEES', 13000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J4300', '5162', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0552', '5163', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J9775', '5164', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AB1776', '5165', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0404', '5166', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD14AC5502', '5167', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.customer_payments (pump_id, day_id, shift_id, customer_id, payment_type_id, amount, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('United Infracore LTD') order by created_at limit 1), (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 208165.49, v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('TEA') order by created_at limit 1), null, 40.00, 'SHIFT_C', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Tanker driver food') order by created_at limit 1), 'Boxix', 500.00, 'SHIFT_C', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Tanker unloading') order by created_at limit 1), null, 350.00, 'SHIFT_C', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Staff food') order by created_at limit 1), 'Jitu, Linga, Rudra', 300.00, 'SHIFT_C', v_owner);
  update public.shifts set opening_cash = 27644.20, sales_done_at = now() where id = v_shift;
  -- Tanker WB29D9510, invoice 7011575177
  insert into public.tanker_receipts (id, pump_id, day_id, vehicle_no, invoice_no, invoice_date, created_by)
  values (gen_random_uuid(), v_pump, v_day, 'WB29D9510', '7011575177', date '2026-10-03', v_owner);
  insert into public.receipt_lines (pump_id, day_id, receipt_id, product, tank_id, ordered_l, short_l, price_per_l, margin_per_l, dip_before_cm, dip_after_cm, created_by)
  values (v_pump, v_day, (select id from public.tanker_receipts where day_id = v_day and invoice_no = '7011575177'), 'HSD',
    (select id from public.tanks where pump_id = v_pump and label = 'HSD-1'), 14000, 41, 99.14, 2.60, 50.2, 162.2, v_owner);
  insert into public.receipt_chambers (pump_id, day_id, receipt_line_id, chamber_no, litres, dip_after_cm, dip_before_cm, next_day, created_by)
  values (v_pump, v_day, (select l.id from public.receipt_lines l join public.tanker_receipts r on r.id = l.receipt_id where r.day_id = v_day and r.invoice_no = '7011575177'),
    1, 14000, 162.2, null, false, v_owner);
  insert into public.customer_payments (pump_id, day_id, shift_id, customer_id, payment_type_id, amount, created_by)
  values (v_pump, v_day, null, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Bijay Kumar Sahoo') order by created_at limit 1), (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 650000.00, v_owner);
  insert into public.customer_payments (pump_id, day_id, shift_id, customer_id, payment_type_id, amount, created_by)
  values (v_pump, v_day, null, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('SVT LOGISTICS') order by created_at limit 1), (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 150000.00, v_owner);
  if (select sum(rupees) from public.credit_sales where day_id = v_day) <> 445069.65 then
    raise exception '2026-10-03: credit slips don''t add up to the notebook''s ₹445069.65. Nothing was changed.';
  end if;

  -- ═══ 2026-10-04 ═══
  select id into v_day from public.business_days where pump_id = v_pump and business_date = date '2026-10-04';
  if v_day is null then
    insert into public.business_days (pump_id, business_date, created_by) values (v_pump, date '2026-10-04', v_owner) returning id into v_day;
  end if;
  perform private.ensure_shifts(v_day);
  update public.business_days set ms_price = public.price_for(v_pump, 'MS', business_date), hsd_price = public.price_for(v_pump, 'HSD', business_date),
    price_confirmed_by = v_owner, price_confirmed_at = now(), no_tanker = true where id = v_day;
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'MS-1'), 'OPENING', 78.8, v_owner);
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'MS-1'), 'CLOSING', 77.2, v_owner);
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'HSD-1'), 'OPENING', 149.2, v_owner);
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'HSD-1'), 'CLOSING', 37.4, v_owner);
  -- Shift A
  select id into v_shift from public.shifts where day_id = v_day and shift_code = 'A';
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Jitendra Kumar Sahoo'), v_owner);
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Lingaraj Behera'), v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 131380.07, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 30597.76, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 620293.70, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 1030867.35, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 5, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 5, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 5, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 5, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash'), 33152.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 26210.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'PhonePe'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Debit card'), 5000.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Credit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 1942098.55, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash deposited in bank'), 0.00, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Bijay Kumar Sahoo') order by created_at limit 1), 'OD19Z3404', '4512', 'HSD', 'LITRES', 380, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Lingaraj Behera') order by created_at limit 1), 'OD04L5651', '5209', 'HSD', 'RUPEES', 10000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Darcel Logistics LTD') order by created_at limit 1), 'BR11GG2391', '5178', 'HSD', 'RUPEES', 28847, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('United Infracore LTD') order by created_at limit 1), 'OD24U6630', '665', 'HSD', 'LITRES', 3500, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('United Infracore LTD') order by created_at limit 1), 'JH05DQ5248', '667', 'HSD', 'LITRES', 4000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J6080', '5179', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AD3939', '5180', 'HSD', 'RUPEES', 13000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'CG04MK2077', '5181', 'HSD', 'RUPEES', 13000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0465', '5182', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC3587', '5183', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AB1783', '5184', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC3806', '5185', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0594', '5186', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0572', '5187', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J8551', '5188', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K1079', '5189', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.customer_payments (pump_id, day_id, shift_id, customer_id, payment_type_id, amount, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('United Infracore LTD') order by created_at limit 1), (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 1940598.55, v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('TEA') order by created_at limit 1), null, 40.00, 'SHIFT_A', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Bill printing') order by created_at limit 1), 'UIL bill', 20.00, 'SHIFT_A', v_owner);
  update public.shifts set opening_cash = 32556.22, sales_done_at = now() where id = v_shift;
  -- Shift B
  select id into v_shift from public.shifts where day_id = v_day and shift_code = 'B';
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Gurucharan Sahoo'), v_owner);
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Tuna Dehury'), v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 131459.27, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 30614.52, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 620880.71, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 1031481.50, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash'), 38823.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 11670.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'PhonePe'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Debit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Credit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 14212.03, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash deposited in bank'), 0.00, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Utility Ashok') order by created_at limit 1), 'NL01AK2019', '5215', 'HSD', 'LITRES', 20, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AE4005', '5206', 'HSD', 'RUPEES', 12000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19Z5005', '5207', 'HSD', 'RUPEES', 12000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD02DU2099', '5210', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD15K2647', '5212', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AB1703', '5213', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K0853', '5214', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35H9924', '5216', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('TEA') order by created_at limit 1), null, 80.00, 'SHIFT_B', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Fooding Rudra') order by created_at limit 1), null, 100.00, 'SHIFT_B', v_owner);
  update public.shifts set opening_cash = 33151.84, sales_done_at = now() where id = v_shift;
  -- Shift C
  select id into v_shift from public.shifts where day_id = v_day and shift_code = 'C';
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Gobardhan Dalei'), v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 131497.67, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 30614.52, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 622389.44, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 1032459.58, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash'), 45511.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 24017.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'PhonePe'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Debit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Credit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 22000.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash deposited in bank'), 0.00, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Darcel Logistics LTD') order by created_at limit 1), 'RJ02GB2052', '5217', 'HSD', 'RUPEES', 33510, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35H0618', '5218', 'HSD', 'RUPEES', 12000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35H9949', '5219', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0486', '5220', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC3885', '5221', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD15Q8284', '5222', 'HSD', 'RUPEES', 13000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K0897', '5223', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K0844', '5224', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K0631', '5225', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0534', '5226', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD04Q0129', '5227', 'HSD', 'RUPEES', 10000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC3989', '5228', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K1065', '5230', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('TEA') order by created_at limit 1), null, 20.00, 'SHIFT_C', v_owner);
  update public.shifts set opening_cash = 38823.35, sales_done_at = now() where id = v_shift;
  if (select sum(rupees) from public.credit_sales where day_id = v_day) <> 1306103.00 then
    raise exception '2026-10-04: credit slips don''t add up to the notebook''s ₹1306103.00. Nothing was changed.';
  end if;

  -- ═══ 2026-10-05 ═══
  select id into v_day from public.business_days where pump_id = v_pump and business_date = date '2026-10-05';
  if v_day is null then
    insert into public.business_days (pump_id, business_date, created_by) values (v_pump, date '2026-10-05', v_owner) returning id into v_day;
  end if;
  perform private.ensure_shifts(v_day);
  update public.business_days set ms_price = public.price_for(v_pump, 'MS', business_date), hsd_price = public.price_for(v_pump, 'HSD', business_date),
    price_confirmed_by = v_owner, price_confirmed_at = now(), no_tanker = false where id = v_day;
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'MS-1'), 'OPENING', 77.2, v_owner);
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'MS-1'), 'CLOSING', 75.8, v_owner);
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'HSD-1'), 'OPENING', 37.4, v_owner);
  insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, created_by)
  values (v_pump, v_day, (select id from public.tanks where pump_id = v_pump and label = 'HSD-1'), 'CLOSING', 121.4, v_owner);
  -- Shift A
  select id into v_shift from public.shifts where day_id = v_day and shift_code = 'A';
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Gurucharan Sahoo'), v_owner);
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Tuna Dehury'), v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 131594.03, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 30619.97, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 622566.83, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 1032888.08, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 5, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 5, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash'), 10821.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 5247.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'PhonePe'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Debit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Credit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash deposited in bank'), 40000.00, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Bijay Kumar Sahoo') order by created_at limit 1), 'OD19Z3404', '4513', 'HSD', 'LITRES', 380, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Bijay Kumar Sahoo') order by created_at limit 1), 'OD19Z3404', '4514', 'HSD', 'LITRES', 48.50, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K0673', '5238', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Repairs') order by created_at limit 1), 'Automation work, electrician', 500.00, 'SHIFT_A', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('TEA') order by created_at limit 1), null, 40.00, 'SHIFT_A', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Repairs') order by created_at limit 1), 'Automation, Ashish', 1000.00, 'SHIFT_A', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('MS for errands') order by created_at limit 1), 'Bank', 50.00, 'SHIFT_A', v_owner);
  update public.shifts set opening_cash = 45511.08, sales_done_at = now() where id = v_shift;
  -- Shift B
  select id into v_shift from public.shifts where day_id = v_day and shift_code = 'B';
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Lingaraj Behera'), v_owner);
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Gobardhan Dalei'), v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 131674.05, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 30620.87, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 622566.83, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 1032888.08, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash'), 14073.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 4775.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'PhonePe'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Debit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Credit card'), 9000.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash deposited in bank'), 0.00, v_owner);
  insert into public.customer_payments (pump_id, day_id, shift_id, customer_id, payment_type_id, amount, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('Lingaraj Behera') order by created_at limit 1), (select id from public.payment_types where pump_id = v_pump and name = 'Credit card'), 9000.00, v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Bill printing') order by created_at limit 1), 'Bhawani and Motanga PS bills', 500.00, 'SHIFT_B', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('MS for errands') order by created_at limit 1), 'Bill, motor (Rudra)', 50.00, 'SHIFT_B', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('MS for errands') order by created_at limit 1), 'Motanga PS bill (Dehury)', 50.00, 'SHIFT_B', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('MS for errands') order by created_at limit 1), 'Angul (Rudra)', 100.00, 'SHIFT_B', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Fooding Rudra') order by created_at limit 1), null, 100.00, 'SHIFT_B', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('TEA') order by created_at limit 1), null, 80.00, 'SHIFT_B', v_owner);
  update public.shifts set opening_cash = 10820.66, sales_done_at = now() where id = v_shift;
  -- Shift C
  select id into v_shift from public.shifts where day_id = v_day and shift_code = 'C';
  insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id, created_by)
  values (v_pump, v_day, v_shift, (select id from public.staff where pump_id = v_pump and name = 'Jitendra Kumar Sahoo'), v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-3'), 131684.50, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'MS-4'), 30620.87, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 625471.34, v_owner);
  insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 1034932.06, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-3'), 5, v_owner);
  insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, created_by)
  values (v_pump, v_day, v_shift, (select id from public.nozzles where pump_id = v_pump and label = 'HSD-4'), 5, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash'), 14135.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Paytm'), 11000.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'PhonePe'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Debit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Credit card'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'XtraPower'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Bank transfer'), 0.00, v_owner);
  insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount, created_by) values (v_pump, v_day, v_shift, (select id from public.payment_types where pump_id = v_pump and name = 'Cash deposited in bank'), 0.00, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0628', '5241', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35H9941', '5244', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'CG04MK2077', '5242', 'HSD', 'RUPEES', 13000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'WB41K2687', '5243', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35H9982', '5245', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AB1783', '5246', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J8551', '5248', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0465', '5247', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K1032', '5249', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K1011', '5250', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD06K8188', '5252', 'HSD', 'RUPEES', 13000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AB1703', '5254', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0404', '5251', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0572', '5253', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K1079', '5256', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0594', '5255', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35H9924', '5257', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35H7770', '5258', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35K0866', '5260', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AB1745', '5259', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J4300', '5261', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J9775', '5262', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC3806', '5263', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J0552', '5264', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC3485', '5265', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC3587', '5266', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD15K2647', '5267', 'HSD', 'RUPEES', 14000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD02DU2099', '5268', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC5502', '5271', 'HSD', 'RUPEES', 16000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD35J6080', '5272', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AC3885', '5269', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD23E5599', '5270', 'HSD', 'RUPEES', 11000, v_owner);
  insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, created_by)
  values (v_pump, v_day, v_shift, (select id from public.credit_customers where pump_id = v_pump and lower(name) = lower('MBRPL') order by created_at limit 1), 'OD19AB1776', '5273', 'HSD', 'RUPEES', 15000, v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('TEA') order by created_at limit 1), null, 20.00, 'SHIFT_C', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Repairs') order by created_at limit 1), 'Printer repairing', 300.00, 'SHIFT_C', v_owner);
  insert into public.expenses (pump_id, day_id, category_id, description, amount, paid_from, created_by)
  values (v_pump, v_day, (select id from public.expense_categories where pump_id = v_pump and lower(name) = lower('Staff food') order by created_at limit 1), 'Rudra, Kasinath', 200.00, 'SHIFT_C', v_owner);
  update public.shifts set opening_cash = 14072.52, sales_done_at = now() where id = v_shift;
  -- Tanker OD02AV2691, invoice 7011633087
  insert into public.tanker_receipts (id, pump_id, day_id, vehicle_no, invoice_no, invoice_date, created_by)
  values (gen_random_uuid(), v_pump, v_day, 'OD02AV2691', '7011633087', date '2026-10-05', v_owner);
  insert into public.receipt_lines (pump_id, day_id, receipt_id, product, tank_id, ordered_l, short_l, price_per_l, margin_per_l, dip_before_cm, dip_after_cm, created_by)
  values (v_pump, v_day, (select id from public.tanker_receipts where day_id = v_day and invoice_no = '7011633087'), 'HSD',
    (select id from public.tanks where pump_id = v_pump and label = 'HSD-1'), 20000, 78, 99.14, 2.60, 31.2, 153.2, v_owner);
  insert into public.receipt_chambers (pump_id, day_id, receipt_line_id, chamber_no, litres, dip_after_cm, dip_before_cm, next_day, created_by)
  values (v_pump, v_day, (select l.id from public.receipt_lines l join public.tanker_receipts r on r.id = l.receipt_id where r.day_id = v_day and r.invoice_no = '7011633087'),
    1, 4000, 67.2, null, false, v_owner);
  insert into public.receipt_chambers (pump_id, day_id, receipt_line_id, chamber_no, litres, dip_after_cm, dip_before_cm, next_day, created_by)
  values (v_pump, v_day, (select l.id from public.receipt_lines l join public.tanker_receipts r on r.id = l.receipt_id where r.day_id = v_day and r.invoice_no = '7011633087'),
    2, 4000, 98.4, null, false, v_owner);
  insert into public.receipt_chambers (pump_id, day_id, receipt_line_id, chamber_no, litres, dip_after_cm, dip_before_cm, next_day, created_by)
  values (v_pump, v_day, (select l.id from public.receipt_lines l join public.tanker_receipts r on r.id = l.receipt_id where r.day_id = v_day and r.invoice_no = '7011633087'),
    3, 4000, 129.6, null, false, v_owner);
  insert into public.receipt_chambers (pump_id, day_id, receipt_line_id, chamber_no, litres, dip_after_cm, dip_before_cm, next_day, created_by)
  values (v_pump, v_day, (select l.id from public.receipt_lines l join public.tanker_receipts r on r.id = l.receipt_id where r.day_id = v_day and r.invoice_no = '7011633087'),
    4, 4000, 162.2, null, false, v_owner);
  insert into public.receipt_chambers (pump_id, day_id, receipt_line_id, chamber_no, litres, dip_after_cm, dip_before_cm, next_day, created_by)
  values (v_pump, v_day, (select l.id from public.receipt_lines l join public.tanker_receipts r on r.id = l.receipt_id where r.day_id = v_day and r.invoice_no = '7011633087'),
    5, 4000, 153.2, 121.4, true, v_owner);
  if (select sum(rupees) from public.credit_sales where day_id = v_day) <> 551595.59 then
    raise exception '2026-10-05: credit slips don''t add up to the notebook''s ₹551595.59. Nothing was changed.';
  end if;
end $$;

-- Result: each day's fuel check and each shift's money, to compare with the notebooks.
select d.business_date as day, m.product as fuel, round(m.sold_as_per_tank, 2) as sold_as_per_tank,
       round(m.sold_as_per_meters, 2) as sold_as_per_meters, round(m.difference, 2) as difference,
       (select string_agg(s.shift_code || ' ' || coalesce(round(sm.difference, 2)::text, '-'), ' · ' order by s.shift_code)
        from public.shifts s join public.v_shift_money sm on sm.shift_id = s.id where s.day_id = d.id) as shift_money_difference
from public.business_days d join public.v_day_match m on m.day_id = d.id
where d.business_date between date '2026-10-01' and date '2026-10-05'
order by d.business_date, m.product;
