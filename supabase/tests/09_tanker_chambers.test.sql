-- Tanker fixes: invoice amount typed from the challan, chamber-by-chamber dips (owner, 27 Sep).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'manager.x@users.pumphisaab.com'),
                                          ('33333333-3333-3333-3333-333333333333', 'manager.y@users.pumphisaab.com');
create temp table ids on commit drop as
select p.id as x, gen_random_uuid() as y, gen_random_uuid() as receipt, gen_random_uuid() as line,
       (select id from public.tanks where pump_id = p.id and product = 'HSD') as hsd
from public.pumps p where p.name = 'Shree Lokanath Filling Station';
grant select on ids to authenticated;
insert into public.pump_members (pump_id, user_id, username, full_name, role)
  select x, '22222222-2222-2222-2222-222222222222', 'manager.x', 'Manager X', 'MANAGER' from ids;
insert into public.pumps (id, name, rules) select y, 'Pump Y', '{}'::jsonb from ids;
insert into public.pump_members (pump_id, user_id, username, full_name, role)
  select y, '33333333-3333-3333-3333-333333333333', 'manager.y', 'Manager Y', 'MANAGER' from ids;

set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
create temp table d on commit drop as select public.open_day((select x from ids)) as day;
insert into public.tanker_receipts (id, pump_id, day_id, vehicle_no, invoice_no, invoice_amount)
  select receipt, x, (select day from d), 'OD02CD9087', '7018875672', 1388011 from ids;
insert into public.receipt_lines (id, pump_id, day_id, receipt_id, product, tank_id, ordered_l, short_l, price_per_l, margin_per_l, dip_before_cm, dip_after_cm)
  select line, x, (select day from d), receipt, 'HSD', hsd, 14000, 28, 99.14, 2.60, 59.8, 122.2 from ids;

select lives_ok($$ insert into public.receipt_chambers (pump_id, day_id, receipt_line_id, chamber_no, litres, dip_after_cm) values
  ((select x from ids), (select day from d), (select line from ids), 1, 4000, 91.7),
  ((select x from ids), (select day from d), (select line from ids), 2, 4000, 122.2) $$, 'A manager saves chamber dips');
select is((select array_agg(round(rise_l, 2) order by chamber_no) from public.v_receipt_chambers where receipt_line_id = (select line from ids)),
  array[3999.99, 3985.55]::numeric[], 'Each chamber''s rise: from the dip before unloading, then from the previous chamber');
select is((select to_pay from public.v_tanker_totals where receipt_id = (select receipt from ids)), 1388011 - 28 * 99.14,
  'To pay = the challan''s invoice amount − short amount');
select throws_ok($$ insert into public.receipt_chambers (pump_id, day_id, receipt_line_id, chamber_no, litres, dip_after_cm)
  values ((select x from ids), (select day from d), (select line from ids), 3, 2000, 250) $$, 'P0001', null, 'H3: a chamber dip outside the chart is refused');
select throws_ok($$ insert into public.receipt_chambers (pump_id, day_id, receipt_line_id, chamber_no, litres, dip_after_cm)
  values ((select x from ids), (select day from d), (select line from ids), 3, -5, 150) $$, '23514', null, 'H5: negative chamber litres are refused');
delete from public.tanker_receipts where id = (select receipt from ids);
select is((select count(*) from public.receipt_chambers where receipt_line_id = (select line from ids)), 0::bigint, 'Removing the tanker removes its chambers');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.v_receipt_chambers), 0::bigint, 'Pump Y sees none of pump X''s chambers');

select * from finish();
rollback;
