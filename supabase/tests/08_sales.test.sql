-- Slice 4d: cash note count, other payments, credit slips (D27, H6, H7, H9), customer payments
-- (D29, D47), drawer opening cash (D46), the money check per shift (S2), security.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ── Setup (as the database owner) ─────────────────────────────────────────
insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'manager.x@users.pumphisaab.com'),
  ('33333333-3333-3333-3333-333333333333', 'manager.y@users.pumphisaab.com');

create temp table ids on commit drop as
select
  p.id as x,
  gen_random_uuid() as y,
  public.current_business_date(p.id) as today,
  (select id from public.nozzles where pump_id = p.id and label = 'HSD-3') as hsd3,
  (select id from public.nozzles where pump_id = p.id and label = 'MS-3') as ms3,
  (select id from public.payment_types where pump_id = p.id and name = 'Cash') as cash,
  (select id from public.payment_types where pump_id = p.id and name = 'Paytm') as paytm,
  (select id from public.payment_types where pump_id = p.id and name = 'XtraPower') as xtra,
  (select id from public.payment_types where pump_id = p.id and name = 'Bank transfer') as bank,
  (select id from public.cash_denominations where pump_id = p.id and value = 500) as n500,
  (select id from public.cash_denominations where pump_id = p.id and value = 200) as n200,
  gen_random_uuid() as svt,
  gen_random_uuid() as maa,
  gen_random_uuid() as old_day
from public.pumps p where p.name = 'Shree Lokanath Filling Station';
grant select on ids to authenticated, anon;

insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select x from ids), '22222222-2222-2222-2222-222222222222', 'manager.x', 'Manager X', 'MANAGER');
insert into public.pumps (id, name, rules) select y, 'Pump Y', '{}'::jsonb from ids;
insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select y from ids), '33333333-3333-3333-3333-333333333333', 'manager.y', 'Manager Y', 'MANAGER');
insert into public.business_days (id, pump_id, business_date, status) select old_day, x, today - 6, 'LOCKED' from ids;

-- ── Manager of pump X ─────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
create temp table d on commit drop as select public.open_day((select x from ids)) as day;
create temp table s on commit drop as select
  (select id from public.shifts where day_id = (select day from d) and shift_code = 'A') as a,
  (select id from public.shifts where day_id = (select day from d) and shift_code = 'B') as b;

select lives_ok($$ insert into public.credit_customers (id, pump_id, name) values ((select svt from ids), (select x from ids), 'S.V.T. Logistics') $$,
  'D50: a manager adds a new credit customer');
insert into public.credit_customers (id, pump_id, name) select maa, x, 'Maa Bhawani Roadlines' from ids;
select throws_ok($$ insert into public.credit_customers (pump_id, name) values ((select y from ids), 'Sneaky') $$,
  '42501', null, 'but not to another pump');

select throws_ok($$ insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, litres, rate)
  values ((select x from ids), (select day from d), (select a from s), (select svt from ids), 'OD29N6315', '4461', 'HSD', 'RUPEES', 1000, 1, 1) $$,
  'P0001', 'Confirm today''s price on Today before adding a credit slip.', 'H6: no credit slip before the price is confirmed');
select public.confirm_prices((select day from d));

-- Shift A: HSD 100 L and MS 10 L sold as per meters.
insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, opening, opening_typed, closing) values
  ((select x from ids), (select day from d), (select a from s), (select hsd3 from ids), 1000, true, 1100),
  ((select x from ids), (select day from d), (select a from s), (select ms3 from ids), 500, true, 510);

select lives_ok($$ insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, litres, rate)
  values ((select x from ids), (select day from d), (select a from s), (select svt from ids), 'od29 n-6315', '4461', 'HSD', 'RUPEES', 1000, 1, 1) $$,
  'A credit slip typed in rupees');
select is((select litres::text || ' L at ' || rate::text || ' · ' || vehicle_no from public.credit_sales where slip_no = '4461'),
  '9.83 L at 101.74 · OD29N6315', 'D27: ₹1,000 ÷ ₹101.74 = 9.8289… → 9.83 L (rounded up); rate is the confirmed price, vehicle in capitals');
select lives_ok($$ insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, rupees, rate)
  values ((select x from ids), (select day from d), (select a from s), (select maa from ids), 'OD05AR8799', '782', 'MS', 'LITRES', 2.5, 1, 1) $$,
  'A credit slip typed in litres');
select is((select rupees from public.credit_sales where slip_no = '782'), 275.18, 'D27: 2.5 L × ₹110.07 = ₹275.175 → ₹275.18');
select throws_ok($$ insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees, litres, rate)
  values ((select x from ids), (select day from d), (select a from s), (select maa from ids), 'OD05AB1234', ' 4461 ', 'HSD', 'RUPEES', 500, 1, 1) $$,
  '23505', 'Slip 4461 is already saved for S.V.T. Logistics. Check the slip number.', 'H7: a slip number can''t be used twice, and the message names who has it');
delete from public.credit_sales where slip_no = '782';

-- Cash: 10 × ₹500 + 5 × ₹200 + ₹274.70 coins = ₹6,274.70. Drawer started empty.
insert into public.cash_counts (pump_id, day_id, shift_id, denomination_id, note_count) values
  ((select x from ids), (select day from d), (select a from s), (select n500 from ids), 10),
  ((select x from ids), (select day from d), (select a from s), (select n200 from ids), 5);
insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins) select x, (select day from d), (select a from s), cash, 274.70 from ids;
update public.shifts set opening_cash = 0 where id = (select a from s);
-- Paytm ₹3,000; XtraPower ₹2,000 of which ₹1,000 is S.V.T.'s old dues (taken off, D47).
insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount) values
  ((select x from ids), (select day from d), (select a from s), (select paytm from ids), 3000),
  ((select x from ids), (select day from d), (select a from s), (select xtra from ids), 2000);
insert into public.customer_payments (pump_id, day_id, shift_id, customer_id, payment_type_id, amount)
  select x, (select day from d), (select a from s), svt, xtra, 1000 from ids;
-- ₹50,000 of Maa Bhawani's dues by bank transfer: no shift, never taken off (D47).
select lives_ok($$ insert into public.customer_payments (pump_id, day_id, shift_id, customer_id, payment_type_id, amount)
  values ((select x from ids), (select day from d), null, (select maa from ids), (select bank from ids), 50000) $$,
  'Bank-transfer dues are recorded with no shift');

select is((select cash_counted from public.v_shift_money where shift_id = (select a from s)), 6274.70, 'Cash counted = notes × value + coins');
select is((select should_have from public.v_shift_money where shift_id = (select a from s)), 11274.70,
  'Should have = 100 L × ₹101.74 + 10 L × ₹110.07 = ₹11,274.70');
select is((select array[received, difference, dues_taken_off] from public.v_shift_money where shift_id = (select a from s)),
  array[11274.70, 0.00, 1000.00]::numeric[],
  'Received = 6,274.70 + 3,000 + 2,000 + credit 1,000 − XtraPower dues 1,000 = ₹11,274.70; Difference 0');
select is((select s2_flag from public.v_shift_money where shift_id = (select a from s)), false, 'S2 is quiet at ₹0');
update public.shift_payments set amount = 1500 where shift_id = (select a from s) and payment_type_id = (select paytm from ids);
select ok((select difference = -1500 and s2_flag from public.v_shift_money where shift_id = (select a from s)),
  'Paytm ₹1,500 less: Difference −₹1,500 and S2 (beyond ₹100)');

select is((select received from public.v_shift_money where shift_id = (select b from s)), null,
  'Shift B: nothing worked out until its cash is counted');
select is((select opening_cash from public.v_shift_money where shift_id = (select b from s)), 6274.70,
  'D46: Shift B starts with Shift A''s counted cash unless typed');
select lives_ok($$ update public.shifts set opening_cash = 4000 where id = (select b from s) $$, 'The manager can change the starting cash');
select is((select opening_cash from public.v_shift_money where shift_id = (select b from s)), 4000.00, 'and the typed amount is used');
select throws_ok($$ update public.shifts set starts_at = now() where id = (select b from s) $$, '42501', null, 'Shift times stay the database''s');

-- H9: 50 L of diesel on credit in Shift B, where the meters sold nothing yet.
insert into public.credit_sales (pump_id, day_id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, litres, rupees, rate)
  select x, (select day from d), (select b from s), maa, 'OD05AB1234', '4470', 'HSD', 'LITRES', 50, 1, 1 from ids;
select is((select array_agg(code) from public.day_problems((select day from d))), array['H9'],
  'H9: credit litres more than the litres the meters sold in that shift');

select throws_ok($$ update public.shift_payments set coins = -1 where shift_id = (select a from s) and payment_type_id = (select cash from ids) $$,
  '23514', null, 'H5: negative coins are refused');
select throws_ok($$ insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, amount)
  values ((select x from ids), (select old_day from ids), (select a from s), (select paytm from ids), 10) $$,
  null, null, 'Nothing can be added to a locked day (or to a shift of another day)');

-- ── Manager of pump Y ─────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.credit_sales), 0::bigint, 'Pump Y sees none of pump X''s credit slips');
select is((select count(*) from public.v_shift_money), 0::bigint, 'nor its money');

select * from finish();
rollback;
