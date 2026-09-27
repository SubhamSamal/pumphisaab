-- Slice 4c: tanker receipts, received = ordered − short, totals, dip check, S6, security, locking.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- ── Setup (as the database owner) ─────────────────────────────────────────
insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'manager.x@users.pumphisaab.com'),
  ('33333333-3333-3333-3333-333333333333', 'manager.y@users.pumphisaab.com');

create temp table ids on commit drop as
select
  p.id as x,
  gen_random_uuid() as y,
  public.current_business_date(p.id) as today,
  (select id from public.tanks where pump_id = p.id and product = 'HSD') as hsd,
  (select id from public.tanks where pump_id = p.id and product = 'MS') as ms,
  gen_random_uuid() as receipt,
  gen_random_uuid() as old_day
from public.pumps p where p.name = 'Shree Lokanath Filling Station';
grant select on ids to authenticated, anon;

insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select x from ids), '22222222-2222-2222-2222-222222222222', 'manager.x', 'Manager X', 'MANAGER');
insert into public.pumps (id, name, rules) select y, 'Pump Y', '{}'::jsonb from ids;
insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select y from ids), '33333333-3333-3333-3333-333333333333', 'manager.y', 'Manager Y', 'MANAGER');
insert into public.business_days (id, pump_id, business_date, status) select old_day, x, today - 5, 'LOCKED' from ids;

-- ── Manager of pump X ─────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
create temp table d on commit drop as select public.open_day((select x from ids)) as day;

select lives_ok($$ insert into public.tanker_receipts (id, pump_id, day_id, vehicle_no, invoice_no, invoice_date)
  values ((select receipt from ids), (select x from ids), (select day from d), 'OD02CD9087', '7018875672', (select today - 1 from ids)) $$,
  'A manager adds a tanker');
select lives_ok($$ insert into public.receipt_lines (pump_id, day_id, receipt_id, product, tank_id, ordered_l, short_l, price_per_l, margin_per_l, dip_before_cm, dip_after_cm)
  values ((select x from ids), (select day from d), (select receipt from ids), 'HSD', (select hsd from ids), 14000, 28, 99.14, 2.60, 59.8, 119.8) $$,
  'with a diesel line (the 15 Sep challan: 14,000 L, 28 L short)');
select lives_ok($$ insert into public.receipt_lines (pump_id, day_id, receipt_id, product, tank_id, ordered_l, short_l, price_per_l, margin_per_l)
  values ((select x from ids), (select day from d), (select receipt from ids), 'MS', (select ms from ids), 4000, 20, 96.10, 4.90) $$,
  'and a petrol line');

select is((select received_l from public.v_receipt_lines where product = 'HSD' and receipt_id = (select receipt from ids)), 13972.00,
  'Received = ordered − short (D23): 13,972 L');
select is((select round(dip_rise_l, 2) from public.v_receipt_lines where product = 'HSD' and receipt_id = (select receipt from ids)), 7674.44,
  'Dip rise from the chart: 59.8 → 119.8 cm = 7,674.44 L');
select is((select array[s6_short, s6_dip] from public.v_receipt_lines where product = 'HSD' and receipt_id = (select receipt from ids)), array[false, true],
  'S6: 28 L short of 14,000 L is fine (0.2%); a dip rise far from 13,972 L is flagged');
select is((select s6_short from public.v_receipt_lines where product = 'MS' and receipt_id = (select receipt from ids)), true,
  'S6: petrol 20 L short of 4,000 L (0.5%) is beyond 0.3%');
select is((select array[total_amount, total_short_amount, to_pay] from public.v_tanker_totals where receipt_id = (select receipt from ids)),
  array[14000 * 99.14 + 4000 * 96.10, 28 * 99.14 + 20 * 96.10, 14000 * 99.14 + 4000 * 96.10 - 28 * 99.14 - 20 * 96.10]::numeric[],
  'Invoice amount, short amount and to pay add up both fuels');
select is((select total_margin from public.v_tanker_totals where receipt_id = (select receipt from ids)), 13972 * 2.60 + 3980 * 4.90,
  'Margin earned = received × margin per litre');
select is((select array_agg(product || ':' || received_l order by product) from public.v_day_received where day_id = (select day from d)),
  array['HSD:13972.00', 'MS:3980.00'], 'v_day_received gives litres received per fuel for the day');

select throws_ok($$ insert into public.receipt_lines (pump_id, day_id, receipt_id, product, tank_id, ordered_l, short_l)
  values ((select x from ids), (select day from d), (select receipt from ids), 'MS', (select hsd from ids), 100, 0) $$,
  'P0001', null, 'A petrol line can''t go into the diesel tank');
select throws_ok($$ update public.receipt_lines set short_l = 99999 where product = 'MS' and receipt_id = (select receipt from ids) $$,
  '23514', null, 'Short can''t be more than ordered');
select throws_ok($$ update public.receipt_lines set ordered_l = -1 where product = 'MS' and receipt_id = (select receipt from ids) $$,
  '23514', null, 'H5: negative litres are refused');
select throws_ok($$ update public.receipt_lines set dip_after_cm = 250 where product = 'HSD' and receipt_id = (select receipt from ids) $$,
  'P0001', null, 'H3: a dip outside the chart is refused');
select throws_ok($$ insert into public.tanker_receipts (pump_id, day_id, vehicle_no) values ((select x from ids), (select day from d), 'od 02 cd') $$,
  '23514', null, 'Tanker number is saved in capitals without spaces (the app does that)');
select throws_ok($$ insert into public.tanker_receipts (pump_id, day_id, vehicle_no) values ((select x from ids), (select old_day from ids), 'OD02CD9087') $$,
  'P0001', 'This day is locked. Ask the owner to unlock it.', 'No tanker can be added to a locked day');

-- Removing a tanker removes its lines too.
select lives_ok($$ delete from public.tanker_receipts where id = (select receipt from ids) $$, 'A manager removes a tanker added by mistake');
select is((select count(*) from public.receipt_lines where receipt_id = (select receipt from ids)), 0::bigint, 'and its lines go with it');
select is((select count(*) from public.audit_log where table_name = 'receipt_lines'), 0::bigint, 'The manager can''t read the audit log (the removal is still logged)');

-- ── Manager of pump Y ─────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.v_day_received), 0::bigint, 'Pump Y sees none of pump X''s tankers');

select * from finish();
rollback;
